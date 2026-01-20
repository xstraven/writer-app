from __future__ import annotations

import random
import sys
import traceback

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..dependencies import (
    get_snippet_store,
    get_story_settings_store,
)
from ..instructor_client import get_structured_llm_client
from ..models import (
    CharacterAttribute,
    CharacterSheet,
    CharacterSkill,
    GameSystem,
    InventoryItem,
    RPGActionRequest,
    RPGActionResponse,
    RPGActionResult,
    RPGModeSettings,
    RPGSetupRequest,
    RPGSetupResponse,
)
from ..openrouter import OpenRouterClient
from ..prompt_builder import PromptBuilder
from ..snippet_store import SnippetStore
from ..story_settings_store import StorySettingsStore


router = APIRouter()


def roll_dice(num_dice: int = 1, sides: int = 20) -> int:
    """Roll dice and return the total."""
    return sum(random.randint(1, sides) for _ in range(num_dice))


def get_attribute_modifier(value: int) -> int:
    """Calculate D&D-style attribute modifier."""
    return (value - 10) // 2


@router.post("/api/rpg/setup", response_model=RPGSetupResponse)
async def setup_rpg_session(
    req: RPGSetupRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
) -> RPGSetupResponse:
    """
    Initialize an RPG session with worldbuilding.

    The AI will generate:
    - A simple game system tailored to the world setting
    - A player character sheet
    - Optional party members
    - An opening scene/adventure hook
    """
    story = (req.story or "").strip()
    world_setting = (req.world_setting or "").strip()

    if not story:
        raise HTTPException(status_code=400, detail="Missing story name")
    if not world_setting:
        raise HTTPException(status_code=400, detail="Missing world setting description")

    structured = get_structured_llm_client()

    # Generate the game system
    system_prompt = """You are an expert tabletop RPG game designer. Create a simple, elegant game system
that fits the given world setting. The system should be easy to understand and play, similar to
simplified D&D or Dungeon World. Include:
- A core dice mechanic (prefer d20 or 2d6)
- 4-6 core attributes appropriate for the setting
- Simple difficulty levels
- Basic combat and skill check rules

Keep rules concise - this is for quick, narrative-focused play."""

    system_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Create a simple RPG system for this world:\n\n{world_setting}"},
    ]

    try:
        game_system = await structured.create(
            response_model=GameSystem,
            messages=system_messages,
            model=req.model,
            temperature=req.temperature,
            max_retries=2,
            fallback=lambda: GameSystem(
                name="Simple Adventure System",
                core_mechanic="Roll 1d20 + attribute modifier vs difficulty",
                attribute_names=["Strength", "Agility", "Mind", "Spirit"],
                difficulty_levels={"easy": 8, "medium": 12, "hard": 16, "heroic": 20},
                combat_rules="Roll attack (d20 + Strength/Agility) vs target's defense (10 + Agility mod). Damage = weapon die + Strength mod.",
                skill_check_rules="Roll d20 + relevant attribute modifier. Meet or beat the difficulty to succeed.",
            ),
        )
    except Exception:
        game_system = GameSystem(
            name="Simple Adventure System",
            core_mechanic="Roll 1d20 + attribute modifier vs difficulty",
            attribute_names=["Strength", "Agility", "Mind", "Spirit"],
            difficulty_levels={"easy": 8, "medium": 12, "hard": 16, "heroic": 20},
            combat_rules="Roll attack (d20 + Strength/Agility) vs target's defense (10 + Agility mod). Damage = weapon die + Strength mod.",
            skill_check_rules="Roll d20 + relevant attribute modifier. Meet or beat the difficulty to succeed.",
        )

    # Generate player character
    char_name = req.character_name or "Adventurer"
    char_class = req.character_class or "Explorer"

    char_prompt = f"""Create a character sheet for a {char_class} named {char_name} in this world:

World: {world_setting}

Game System: {game_system.name}
Attributes: {', '.join(game_system.attribute_names)}
Core Mechanic: {game_system.core_mechanic}

Generate appropriate attributes (values 8-18, average 10-12), 3-4 starting skills,
starting inventory, and a brief backstory that fits the world."""

    char_messages = [
        {"role": "system", "content": "You are creating a player character for a tabletop RPG. Make them interesting but not overpowered."},
        {"role": "user", "content": char_prompt},
    ]

    try:
        player_character = await structured.create(
            response_model=CharacterSheet,
            messages=char_messages,
            model=req.model,
            temperature=req.temperature,
            max_retries=2,
            fallback=lambda: _create_default_character(char_name, char_class, game_system),
        )
    except Exception:
        player_character = _create_default_character(char_name, char_class, game_system)

    # Generate party members if requested
    party_members = []
    if req.num_party_members > 0:
        party_prompt = f"""Create {req.num_party_members} NPC party member(s) to accompany {char_name} in this world:

World: {world_setting}
Player Character: {char_name} the {char_class}
Game System Attributes: {', '.join(game_system.attribute_names)}

Create diverse, complementary party members with their own personalities and skills."""

        party_messages = [
            {"role": "system", "content": "Create interesting NPC companions for a tabletop RPG party."},
            {"role": "user", "content": party_prompt},
        ]

        try:
            party_members = await structured.create(
                response_model=list[CharacterSheet],
                messages=party_messages,
                model=req.model,
                temperature=req.temperature,
                max_retries=2,
                fallback=lambda: [],
            )
        except Exception:
            party_members = []

    # Generate opening scene
    client = OpenRouterClient()

    opening_prompt = f"""You are the Game Master for a tabletop RPG. Write an engaging opening scene
that introduces the adventure.

World Setting: {world_setting}

Player Character: {player_character.name}, a level {player_character.level} {player_character.character_class}
Backstory: {player_character.backstory}

Write 2-3 paragraphs setting the scene and presenting an initial situation or hook.
End by presenting 3-4 possible actions the player could take.
Address the player in second person ("You find yourself...", "You see...")."""

    opening_messages = (
        PromptBuilder()
        .with_system("You are an engaging Game Master narrating a tabletop RPG adventure.")
        .with_instruction(opening_prompt)
        .with_history_text("")
        .with_draft_text("")
        .build_messages()
    )

    try:
        gen = await client.chat(
            messages=opening_messages,
            model=req.model,
            max_tokens=1024,
            temperature=req.temperature,
        )
        opening_scene = gen.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception:
        opening_scene = f"You find yourself in the {world_setting}. Your adventure begins..."

    if not opening_scene:
        opening_scene = f"You find yourself in the {world_setting}. Your adventure begins..."

    # Generate suggested actions
    available_actions = [
        "Look around and investigate the area",
        "Talk to nearby people",
        "Check your equipment and inventory",
        "Move forward cautiously",
    ]

    # Save RPG settings to story
    rpg_settings = RPGModeSettings(
        enabled=True,
        world_setting=world_setting,
        game_system=game_system,
        player_character=player_character,
        party_members=party_members,
        current_quest="Begin the adventure",
        quest_log=["Started a new adventure"],
        session_notes="",
    )

    story_settings_store.update(story, {
        "rpg_mode_settings": rpg_settings.model_dump(),
        "experimental": {"rpg_mode": True},
    })

    # Create the opening scene as a snippet
    snippet_store.create_snippet(
        story=story,
        content=opening_scene,
        kind="ai",
        parent_id=None,
        set_active=None,
    )

    return RPGSetupResponse(
        story=story,
        game_system=game_system,
        player_character=player_character,
        party_members=party_members,
        opening_scene=opening_scene,
        available_actions=available_actions,
    )


def _create_default_character(name: str, char_class: str, system: GameSystem) -> CharacterSheet:
    """Create a default character if generation fails."""
    attributes = []
    for attr_name in system.attribute_names[:6]:  # Max 6 attributes
        value = random.randint(10, 14)  # Reasonable starting values
        attributes.append(CharacterAttribute(
            name=attr_name,
            value=value,
            max_value=20,
            description=f"Your {attr_name.lower()} attribute",
        ))

    return CharacterSheet(
        name=name,
        character_class=char_class,
        level=1,
        health=20,
        max_health=20,
        attributes=attributes,
        skills=[
            CharacterSkill(name="Combat", level=1, description="Basic fighting ability"),
            CharacterSkill(name="Perception", level=1, description="Awareness of surroundings"),
            CharacterSkill(name="Persuasion", level=1, description="Social interaction"),
        ],
        inventory=[
            InventoryItem(name="Basic Weapon", item_type="weapon", description="A simple weapon for defense"),
            InventoryItem(name="Traveler's Pack", item_type="misc", description="Basic supplies"),
            InventoryItem(name="Gold Coins", quantity=10, item_type="misc", description="Currency"),
        ],
        backstory=f"A {char_class} seeking adventure and fortune.",
    )


@router.post("/api/rpg/action", response_model=RPGActionResponse)
async def perform_rpg_action(
    req: RPGActionRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
) -> RPGActionResponse:
    """
    Perform an action in the RPG and get the narrative result.

    The AI will:
    - Determine if dice rolls are needed
    - Roll appropriate checks
    - Generate narrative based on success/failure
    - Update character state if needed
    """
    story = (req.story or "").strip()
    action = (req.action or "").strip()

    if not story:
        raise HTTPException(status_code=400, detail="Missing story name")
    if not action:
        raise HTTPException(status_code=400, detail="Missing action description")

    # Load current RPG state
    settings = story_settings_store.get(story) or {}
    rpg_settings_data = settings.get("rpg_mode_settings")

    if not rpg_settings_data:
        raise HTTPException(status_code=400, detail="RPG mode not initialized. Call /api/rpg/setup first.")

    rpg_settings = RPGModeSettings.model_validate(rpg_settings_data)

    if not rpg_settings.player_character:
        raise HTTPException(status_code=400, detail="No player character found")

    character = rpg_settings.player_character
    game_system = rpg_settings.game_system

    # Get story context
    path = snippet_store.main_path(story)
    story_text = snippet_store.build_text(path)
    # Use last portion for context
    context_text = story_text[-4000:] if len(story_text) > 4000 else story_text

    # Determine if action needs dice rolls
    action_results = []

    if req.use_dice and game_system:
        # Analyze action to determine if check is needed
        structured = get_structured_llm_client()

        check_prompt = f"""Analyze this player action and determine what dice check(s) are needed:

Action: {action}

Character: {character.name} ({character.character_class})
Attributes: {', '.join(f'{a.name}: {a.value}' for a in character.attributes)}

Game System: {game_system.name}
Core Mechanic: {game_system.core_mechanic}
Difficulty Levels: {game_system.difficulty_levels}

If the action requires a check, specify:
- check_type: The type of check (e.g., "Strength check", "Stealth check")
- target_number: The difficulty target to beat
- description: Brief description of what's being attempted

If no check is needed (simple actions like talking, moving in safe areas), return an empty result."""

        class CheckAnalysis(BaseModel):
            needs_check: bool = False
            check_type: str = ""
            attribute_used: str = ""
            target_number: int = 12
            description: str = ""

        try:
            check_analysis = await structured.create(
                response_model=CheckAnalysis,
                messages=[
                    {"role": "system", "content": "You determine what dice checks are needed for RPG actions."},
                    {"role": "user", "content": check_prompt},
                ],
                model=req.model,
                temperature=0.3,
                max_retries=1,
                fallback=lambda: CheckAnalysis(needs_check=False),
            )
        except Exception:
            check_analysis = CheckAnalysis(needs_check=False)

        if check_analysis.needs_check:
            # Find the attribute modifier
            modifier = 0
            for attr in character.attributes:
                if attr.name.lower() == check_analysis.attribute_used.lower():
                    modifier = get_attribute_modifier(attr.value)
                    break

            # Roll the dice
            roll = roll_dice(1, 20)
            total = roll + modifier
            success = total >= check_analysis.target_number

            action_results.append(RPGActionResult(
                check_type=check_analysis.check_type,
                target_number=check_analysis.target_number,
                roll_result=roll,
                modifier=modifier,
                total=total,
                success=success,
                description=f"{'Success!' if success else 'Failed.'} Rolled {roll} + {modifier} = {total} vs DC {check_analysis.target_number}",
            ))

    # Generate narrative response
    client = OpenRouterClient()

    # Build the narrative prompt
    roll_info = ""
    if action_results:
        roll_info = "\n\nDice Roll Results:\n" + "\n".join(
            f"- {r.check_type}: {r.description}" for r in action_results
        )

    narrative_prompt = f"""You are the Game Master. The player has taken an action. Narrate the result.

World Setting: {rpg_settings.world_setting}

Player Character: {character.name}, Level {character.level} {character.character_class}
Health: {character.health}/{character.max_health}
Current Quest: {rpg_settings.current_quest}

Recent Story Context:
{context_text}

Player's Action: {action}
{roll_info}

Write 1-3 paragraphs describing what happens. Be vivid and engaging.
If there were dice results, incorporate the success or failure naturally into the narrative.
End by suggesting 2-4 possible next actions the player could take.
Address the player in second person."""

    narrative_messages = (
        PromptBuilder()
        .with_system("You are an engaging Game Master narrating a tabletop RPG. Be descriptive but concise.")
        .with_instruction(narrative_prompt)
        .with_history_text("")
        .with_draft_text("")
        .build_messages()
    )

    try:
        gen = await client.chat(
            messages=narrative_messages,
            model=req.model,
            max_tokens=1024,
            temperature=req.temperature,
        )
        narrative = gen.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        narrative = f"You attempt to {action}. The result is uncertain..."

    if not narrative:
        narrative = f"You attempt to {action}..."

    # Save the narrative as a snippet
    path = snippet_store.main_path(story)
    parent_id = path[-1].id if path else None

    # Create user action snippet
    snippet_store.create_snippet(
        story=story,
        content=f"> {action}",
        kind="user",
        parent_id=parent_id,
        set_active=True,
    )

    # Get new parent
    path = snippet_store.main_path(story)
    parent_id = path[-1].id if path else None

    # Create AI response snippet
    snippet_store.create_snippet(
        story=story,
        content=narrative,
        kind="ai",
        parent_id=parent_id,
        set_active=True,
    )

    # Extract suggested actions from narrative (simple heuristic)
    available_actions = [
        "Continue exploring",
        "Talk to someone nearby",
        "Rest and recover",
        "Check your surroundings",
    ]

    return RPGActionResponse(
        story=story,
        narrative=narrative,
        action_results=action_results,
        character_updates=None,  # Character unchanged for now
        available_actions=available_actions,
        quest_update="",
    )


@router.get("/api/rpg/state")
async def get_rpg_state(
    story: str,
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
):
    """Get the current RPG state for a story."""
    story = (story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story name")

    settings = story_settings_store.get(story) or {}
    rpg_settings_data = settings.get("rpg_mode_settings")

    if not rpg_settings_data:
        return {"enabled": False}

    return rpg_settings_data


@router.put("/api/rpg/character")
async def update_character(
    story: str,
    character: CharacterSheet,
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
):
    """Update the player character sheet."""
    story = (story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story name")

    settings = story_settings_store.get(story) or {}
    rpg_settings_data = settings.get("rpg_mode_settings")

    if not rpg_settings_data:
        raise HTTPException(status_code=400, detail="RPG mode not initialized")

    rpg_settings = RPGModeSettings.model_validate(rpg_settings_data)
    rpg_settings.player_character = character

    story_settings_store.update(story, {
        "rpg_mode_settings": rpg_settings.model_dump(),
    })

    return {"ok": True, "character": character.model_dump()}


@router.put("/api/rpg/settings")
async def update_rpg_settings(
    story: str,
    updates: dict,
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
):
    """Update RPG mode settings (quest, notes, etc.)."""
    story = (story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story name")

    settings = story_settings_store.get(story) or {}
    rpg_settings_data = settings.get("rpg_mode_settings")

    if not rpg_settings_data:
        raise HTTPException(status_code=400, detail="RPG mode not initialized")

    rpg_settings = RPGModeSettings.model_validate(rpg_settings_data)

    # Apply updates
    if "current_quest" in updates:
        rpg_settings.current_quest = updates["current_quest"]
    if "session_notes" in updates:
        rpg_settings.session_notes = updates["session_notes"]
    if "quest_log" in updates:
        rpg_settings.quest_log = updates["quest_log"]

    story_settings_store.update(story, {
        "rpg_mode_settings": rpg_settings.model_dump(),
    })

    return {"ok": True}
