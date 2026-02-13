from __future__ import annotations

import asyncio
import random
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ..campaign_action_store import CampaignActionStore
from ..campaign_store import CampaignStore
from ..dependencies import (
    get_campaign_action_store,
    get_campaign_store,
    get_player_store,
)
from ..instructor_client import get_structured_llm_client
from ..models import (
    Campaign,
    CampaignWithPlayers,
    CharacterAttribute,
    CharacterSheet,
    CharacterSkill,
    CreateCampaignRequest,
    CreateCampaignResponse,
    GameSystem,
    InventoryItem,
    JoinCampaignRequest,
    JoinCampaignResponse,
    Player,
    StartCampaignRequest,
    StartCampaignResponse,
    AddLocalPlayerRequest,
    AddLocalPlayerResponse,
    BatchAddPlayersRequest,
    BatchAddPlayersResponse,
)
from ..attribute_generator import generate_attributes as _generate_attributes
from ..openrouter import OpenRouterClient
from ..player_store import PlayerStore
from ..prompt_builder import PromptBuilder


router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


def _create_default_character(name: str, char_class: str, system: GameSystem) -> CharacterSheet:
    """Create a default character if generation fails."""
    attributes = []
    for attr_name in system.attribute_names[:6]:
        value = random.randint(10, 14)
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
            InventoryItem(name="Basic Weapon", item_type="weapon", description="A simple weapon"),
            InventoryItem(name="Traveler's Pack", item_type="misc", description="Basic supplies"),
            InventoryItem(name="Gold Coins", quantity=10, item_type="misc", description="Currency"),
        ],
        backstory=f"A {char_class} seeking adventure and fortune.",
    )


async def _generate_character_sheet(
    char_name: str,
    char_concept: str,
    char_special: Optional[str],
    campaign: Campaign,
    attribute_scores: Optional[dict[str, int]] = None,
) -> CharacterSheet:
    """Generate a character sheet for a player, using LLM with fallback defaults.

    If attribute_scores is provided, uses player-allocated values instead of
    AI-generated attributes.
    """
    structured = get_structured_llm_client()
    game_system = campaign.game_system
    is_narrative_style = game_system and game_system.style in ("narrative", "hybrid")

    if not game_system:
        sheet = CharacterSheet(
            name=char_name,
            character_class=char_concept,
            level=1,
            health=20,
            max_health=20,
        )
    elif is_narrative_style:
        special_line = f"\nWhat Makes Them Special: {char_special}" if char_special else ""
        char_prompt = f"""Create a character for a collaborative storytelling game.

Character Name: {char_name}
Character Concept: {char_concept}{special_line}

World: {campaign.world_setting}

Create a simple, memorable character with:
- A clear concept (one sentence describing who they are)
- What makes them special or unique (their gift, talent, or defining trait)
- A brief backstory (2-3 sentences) that connects them to the world
- NO numbered stats or attributes - this is a narrative game

Make them interesting and someone you'd want to go on an adventure with."""

        default_char = CharacterSheet(
            name=char_name,
            character_class=char_concept,
            concept=f"A {char_concept.lower()} ready for adventure",
            special_trait=char_special or "Has a knack for getting into and out of trouble",
            backstory=f"{char_name} is a {char_concept.lower()} who has always dreamed of adventure.",
            level=1,
            health=10,
            max_health=10,
            attributes=[],
            skills=[],
            inventory=[],
        )

        try:
            sheet = await structured.create(
                response_model=CharacterSheet,
                messages=[
                    {"role": "system", "content": "Create a character for a collaborative storytelling game. Focus on personality and story, not game mechanics."},
                    {"role": "user", "content": char_prompt},
                ],
                temperature=0.8,
                max_retries=2,
                fallback=lambda: default_char,
            )
        except Exception:
            sheet = default_char
    else:
        char_prompt = f"""Create a character sheet for a {char_concept} named {char_name} in this world:

World: {campaign.world_setting}

Game System: {game_system.name}
Attributes: {', '.join(game_system.attribute_names)}

Generate appropriate attributes (values 8-18), 3-4 starting skills, starting inventory, and a brief backstory."""

        try:
            sheet = await structured.create(
                response_model=CharacterSheet,
                messages=[
                    {"role": "system", "content": "Create a player character for a tabletop RPG."},
                    {"role": "user", "content": char_prompt},
                ],
                temperature=0.8,
                max_retries=2,
                fallback=lambda: _create_default_character(char_name, char_concept, game_system),
            )
        except Exception:
            sheet = _create_default_character(char_name, char_concept, game_system)

    # Inject player-allocated attribute scores if provided
    if attribute_scores:
        sheet.attributes = [
            CharacterAttribute(
                name=attr_name,
                value=score,
                max_value=20 if game_system and game_system.style == "mechanical" else 3,
                description="",
            )
            for attr_name, score in attribute_scores.items()
        ]

    return sheet


@router.get("", response_model=List[CampaignWithPlayers])
async def list_campaigns(
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
) -> List[CampaignWithPlayers]:
    """List all campaigns the player is part of."""
    if not x_session_token:
        return []

    # Get all campaign IDs this session is part of
    campaign_ids = player_store.list_campaigns_for_session(x_session_token)

    results = []
    for campaign_id in campaign_ids:
        campaign = campaign_store.get(campaign_id)
        if campaign:
            players = player_store.get_by_campaign(campaign_id)
            your_player = player_store.get_by_session_and_campaign(x_session_token, campaign_id)
            results.append(CampaignWithPlayers(
                campaign=campaign,
                players=players,
                your_player=your_player,
            ))

    return results


@router.post("", response_model=CreateCampaignResponse)
async def create_campaign(
    req: CreateCampaignRequest,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
) -> CreateCampaignResponse:
    """Create a new campaign and add the creator as the first player."""
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="Campaign name is required")
    if not req.world_setting or not req.world_setting.strip():
        raise HTTPException(status_code=400, detail="World setting is required")
    if not req.player_name or not req.player_name.strip():
        raise HTTPException(status_code=400, detail="Player name is required")

    # Generate game system based on style preference
    structured = get_structured_llm_client()

    # Determine tone description
    tone_desc = {
        "family_friendly": "family-friendly and appropriate for children, with no violence, scary content, or mature themes",
        "all_ages": "suitable for all ages, with mild adventure peril but nothing too scary or violent",
        "mature": "for mature audiences, with realistic consequences and dramatic tension",
    }.get(req.tone, "suitable for all ages")

    # Language-specific instructions for game system generation
    language_instructions = {
        "de": "WICHTIG: Antworte auf Deutsch.",
        "en": "IMPORTANT: Respond in English.",
    }.get(req.language, "IMPORTANT: Respond in English.")

    if req.style == "narrative":
        # PbtA-style narrative-focused system
        system_prompt = f"""{language_instructions}

You are designing a collaborative storytelling game inspired by Dungeon World and Powered by the Apocalypse games.
Create a simple, narrative-focused game system for the given world. This is for {tone_desc} play.

The system should:
- Use 2d6 dice: 10+ = full success, 7-9 = success with complication, 6- = things get worse
- Focus on storytelling, not numbers - mechanics should fade into the background
- Give the GM (AI) principles like "say yes, and...", "ask questions", "make the world feel alive"
- Define 3-4 simple moves players can always make (like "Act Under Pressure", "Help Someone", "Read the Situation")
- Avoid complex stats - characters are defined by who they are, not numbers
- Encourage collaboration and building on each other's ideas

The tone should be {tone_desc}. Keep everything simple enough for new players and children to understand."""

        system_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Create a narrative-focused game system for this world:\n\n{req.world_setting}"},
        ]

        default_system = GameSystem(
            name="Collaborative Story System",
            style="narrative",
            tone=req.tone,
            core_mechanic="When the outcome is uncertain, roll 2d6. On 10+: you do it! On 7-9: you do it, but there's a complication. On 6-: things get worse, but you learn something.",
            attribute_names=[],  # No stats for narrative games
            difficulty_levels={},  # No difficulty numbers
            combat_rules="Conflicts are resolved through storytelling. Describe what you try to do, and the story will respond.",
            skill_check_rules="You can always try anything your character would reasonably attempt. The dice help decide if complications arise.",
            gm_principles=[
                "Say 'yes, and...' to build on player ideas",
                "Ask questions and use the answers",
                "Make the world feel alive and reactive",
                "Give every character a chance to shine",
                "Present interesting choices, not right answers",
            ],
            player_moves=[
                "Do Something Brave or Risky",
                "Help or Protect Someone",
                "Figure Out What's Really Going On",
                "Connect with Another Character",
            ],
        )
    else:
        # Traditional mechanical system (D&D-style)
        system_prompt = f"""{language_instructions}

You are an expert tabletop RPG game designer. Create a simple, elegant game system
that fits the given world setting. The tone should be {tone_desc}.

The system should be easy to understand, similar to simplified D&D. Include:
- A core dice mechanic (prefer d20 or 2d6)
- 4-6 core attributes appropriate for the setting
- Simple difficulty levels
- Basic combat and skill check rules

Keep rules concise - this is for quick play."""

        system_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Create a simple RPG system for this world:\n\n{req.world_setting}"},
        ]

        default_system = GameSystem(
            name="Simple Adventure System",
            style="mechanical",
            tone=req.tone,
            core_mechanic="Roll 1d20 + attribute modifier vs difficulty",
            attribute_names=["Strength", "Agility", "Mind", "Spirit"],
            difficulty_levels={"easy": 8, "medium": 12, "hard": 16, "heroic": 20},
            combat_rules="Roll attack (d20 + Strength/Agility) vs target's defense. Damage = weapon die + Strength mod.",
            skill_check_rules="Roll d20 + relevant attribute modifier. Meet or beat the difficulty to succeed.",
        )

    try:
        game_system = await structured.create(
            response_model=GameSystem,
            messages=system_messages,
            model=req.model,
            temperature=req.temperature,
            max_retries=2,
            fallback=lambda: default_system,
        )
        # Ensure style and tone are set
        game_system.style = req.style
        game_system.tone = req.tone
    except Exception:
        game_system = default_system

    # Use pre-generated attributes from frontend, or generate new ones
    if req.attribute_details:
        game_system.attribute_details = req.attribute_details
        game_system.attribute_names = [a.name for a in req.attribute_details]
    else:
        try:
            generated_attrs = await _generate_attributes(
                world_setting=req.world_setting.strip(),
                language=req.language,
                model=req.model,
            )
            game_system.attribute_details = generated_attrs
            game_system.attribute_names = [a.name for a in generated_attrs]
        except Exception:
            pass  # attribute_details stays empty, frontend will handle gracefully

    # Create player first to get ID for campaign.created_by
    # We'll create a temporary player, then update after campaign creation
    import uuid
    temp_player_id = str(uuid.uuid4())

    # Create campaign
    campaign = campaign_store.create(
        name=req.name.strip(),
        world_setting=req.world_setting.strip(),
        created_by=temp_player_id,
        description="",
        game_system=game_system,
        language=req.language,
    )

    # Generate character sheet (delegates to shared function)
    char_name = (req.character_name or req.player_name).strip()
    char_concept = (req.character_class or "Adventurer").strip()
    char_special = (req.character_special or "").strip() or None

    character_sheet = await _generate_character_sheet(
        char_name, char_concept, char_special, campaign, req.attribute_scores,
    )

    # Create the player
    player = player_store.create(
        campaign_id=campaign.id,
        name=req.player_name.strip(),
        session_token=x_session_token,
        character_sheet=character_sheet,
        is_gm=True,  # Creator is GM
        turn_position=0,
    )

    # Update campaign with correct player ID
    campaign_store.update(campaign.id, turn_order=[player.id])

    # Re-fetch campaign to get updated data
    campaign = campaign_store.get(campaign.id)

    return CreateCampaignResponse(
        campaign=campaign,
        player=player,
        game_system=game_system,
    )


class CampaignPreviewResponse(BaseModel):
    """Public preview of a campaign for the join flow."""
    name: str
    world_setting: str
    game_system: Optional[GameSystem] = None
    style: str
    status: str


@router.get("/preview/{invite_code}", response_model=CampaignPreviewResponse)
async def preview_campaign(
    invite_code: str,
    campaign_store: CampaignStore = Depends(get_campaign_store),
) -> CampaignPreviewResponse:
    """Preview a campaign by invite code (public, no auth required).

    Returns campaign metadata including attribute_details for the join flow.
    """
    campaign = campaign_store.get_by_invite_code(invite_code.strip())
    if not campaign:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    return CampaignPreviewResponse(
        name=campaign.name,
        world_setting=campaign.world_setting,
        game_system=campaign.game_system,
        style=campaign.game_system.style if campaign.game_system else "narrative",
        status=campaign.status,
    )


@router.get("/{campaign_id}", response_model=CampaignWithPlayers)
async def get_campaign(
    campaign_id: str,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
) -> CampaignWithPlayers:
    """Get a campaign by ID."""
    campaign = campaign_store.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    players = player_store.get_by_campaign(campaign_id)
    your_player = None
    if x_session_token:
        your_player = player_store.get_by_session_and_campaign(x_session_token, campaign_id)

    return CampaignWithPlayers(
        campaign=campaign,
        players=players,
        your_player=your_player,
    )


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
    action_store: CampaignActionStore = Depends(get_campaign_action_store),
):
    """Delete a campaign (creator only)."""
    campaign = campaign_store.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Verify the requester is the creator
    if x_session_token:
        your_player = player_store.get_by_session_and_campaign(x_session_token, campaign_id)
        if not your_player or not your_player.is_gm:
            raise HTTPException(status_code=403, detail="Only the campaign creator can delete")
    else:
        raise HTTPException(status_code=401, detail="Session token required")

    # Delete all related data
    action_store.delete_by_campaign(campaign_id)
    player_store.delete_by_campaign(campaign_id)
    campaign_store.delete(campaign_id)

    return {"ok": True}


@router.post("/join", response_model=JoinCampaignResponse)
async def join_campaign(
    req: JoinCampaignRequest,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
) -> JoinCampaignResponse:
    """Join an existing campaign via invite code."""
    if not req.invite_code or not req.invite_code.strip():
        raise HTTPException(status_code=400, detail="Invite code is required")
    if not req.player_name or not req.player_name.strip():
        raise HTTPException(status_code=400, detail="Player name is required")

    campaign = campaign_store.get_by_invite_code(req.invite_code.strip())
    if not campaign:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    if campaign.status == "completed":
        raise HTTPException(status_code=400, detail="Campaign has ended")

    # Check if already joined
    if x_session_token:
        existing = player_store.get_by_session_and_campaign(x_session_token, campaign.id)
        if existing:
            return JoinCampaignResponse(campaign=campaign, player=existing)

    # Generate character
    char_name = (req.character_name or req.player_name).strip()
    char_class = (req.character_class or "Adventurer").strip()

    character_sheet = await _generate_character_sheet(
        char_name, char_class, None, campaign, req.attribute_scores,
    )

    # Get current player count for turn position
    existing_players = player_store.get_by_campaign(campaign.id)
    turn_position = len(existing_players)

    # Create player
    player = player_store.create(
        campaign_id=campaign.id,
        name=req.player_name.strip(),
        session_token=x_session_token,
        character_sheet=character_sheet,
        is_gm=False,
        turn_position=turn_position,
    )

    # Update turn order
    new_turn_order = campaign.turn_order + [player.id]
    campaign_store.update(campaign.id, turn_order=new_turn_order)

    # Re-fetch campaign
    campaign = campaign_store.get(campaign.id)

    return JoinCampaignResponse(campaign=campaign, player=player)


@router.post("/{campaign_id}/start", response_model=StartCampaignResponse)
async def start_campaign(
    campaign_id: str,
    req: StartCampaignRequest,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
    action_store: CampaignActionStore = Depends(get_campaign_action_store),
) -> StartCampaignResponse:
    """Start the campaign (transition from lobby to active)."""
    campaign = campaign_store.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status != "lobby":
        raise HTTPException(status_code=400, detail="Campaign already started")

    # Verify requester is the creator
    your_player = None
    if x_session_token:
        your_player = player_store.get_by_session_and_campaign(x_session_token, campaign_id)

    if not your_player or not your_player.is_gm:
        raise HTTPException(status_code=403, detail="Only the campaign creator can start")

    players = player_store.get_by_campaign(campaign_id)
    if not players:
        raise HTTPException(status_code=400, detail="Need at least one player to start")

    # Set turn order based on turn_position
    turn_order = [p.id for p in sorted(players, key=lambda p: p.turn_position or 0)]

    # Generate opening scene based on game style
    client = OpenRouterClient()
    game_system = campaign.game_system
    is_narrative_style = game_system and game_system.style == "narrative"
    tone = game_system.tone if game_system else "all_ages"

    # Build tone guidance
    tone_guidance = {
        "family_friendly": "This is a family-friendly adventure for children. Keep it positive, wonder-filled, and age-appropriate with no scary or violent content.",
        "all_ages": "This is an all-ages adventure with mild peril but nothing too scary.",
        "mature": "This adventure has realistic stakes and consequences.",
    }.get(tone, "This is an all-ages adventure.")

    player_descriptions = []
    for p in players:
        if p.character_sheet:
            char = p.character_sheet
            if is_narrative_style:
                desc = f"- {char.name}: {char.concept or char.character_class}"
                if char.special_trait:
                    desc += f" (Special: {char.special_trait})"
                desc += f" - played by {p.name}"
                player_descriptions.append(desc)
            else:
                player_descriptions.append(
                    f"- {char.name}, a {char.character_class} ({p.name})"
                )

    if is_narrative_style:
        # Collaborative storytelling opening
        opening_prompt = f"""You are starting a collaborative storytelling adventure with a group of players.

WORLD: {campaign.world_setting}

THE CHARACTERS:
{chr(10).join(player_descriptions)}

{tone_guidance}

Write an exciting opening scene (2-3 paragraphs) that:
1. Sets the scene vividly - where are they? What do they see, hear, smell?
2. Brings the characters together naturally
3. Presents an intriguing situation that invites exploration
4. Ends with something that asks "What do you do?"

Use "you" to address the group. Make it feel like the beginning of a great story you're telling together.
Keep the tone warm and inviting - this should make everyone excited to play!"""

        system_prompt = f"You are a warm, engaging storyteller starting a collaborative adventure. {tone_guidance} Your goal is to get everyone excited about the story you'll create together."
    else:
        # Traditional RPG opening
        opening_prompt = f"""You are the Game Master for a tabletop RPG. Write an engaging opening scene
that introduces the adventure for a party of heroes.

World Setting: {campaign.world_setting}

Party Members:
{chr(10).join(player_descriptions)}

Write 2-3 paragraphs setting the scene and presenting an initial situation or hook.
The party is together and about to begin their adventure.
End by presenting a situation that requires the party's attention.
Address the party in second person plural ("You all find yourselves...", "The party sees...")."""

        system_prompt = f"You are an engaging Game Master narrating a tabletop RPG adventure for a group. {tone_guidance}"

    opening_messages = (
        PromptBuilder()
        .with_system(system_prompt)
        .with_instruction(opening_prompt)
        .with_history_text("")
        .with_draft_text("")
        .build_messages()
    )

    try:
        gen = await client.chat(
            messages=opening_messages,
            max_tokens=1024,
            temperature=0.8,
        )
        opening_scene = gen.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception:
        opening_scene = f"The party gathers in {campaign.world_setting}. Your adventure begins..."

    if not opening_scene:
        opening_scene = f"The party gathers in {campaign.world_setting}. Your adventure begins..."

    # Record opening scene as first action
    action_store.create(
        campaign_id=campaign_id,
        action_type="gm_narration",
        content=opening_scene,
        player_id=None,
        turn_number=0,
    )

    # Update campaign to active
    first_player = turn_order[0] if turn_order else None
    campaign_store.update(
        campaign_id,
        status="active",
        turn_order=turn_order,
        current_turn_player_id=first_player,
        turn_number=1,
    )

    campaign = campaign_store.get(campaign_id)

    # Return style-appropriate action suggestions
    if is_narrative_style:
        available_actions = [
            "What catches your attention first?",
            "How do you react to what you see?",
            "Talk to one of your companions",
            "Do something only your character would do!",
        ]
    else:
        available_actions = [
            "Look around and investigate",
            "Talk to your companions",
            "Move forward cautiously",
            "Check your equipment",
        ]

    return StartCampaignResponse(
        campaign=campaign,
        opening_scene=opening_scene,
        available_actions=available_actions,
    )


@router.get("/{campaign_id}/players", response_model=List[Player])
async def get_campaign_players(
    campaign_id: str,
    player_store: PlayerStore = Depends(get_player_store),
) -> List[Player]:
    """Get all players in a campaign."""
    return player_store.get_by_campaign(campaign_id)


@router.post("/{campaign_id}/players", response_model=AddLocalPlayerResponse)
async def add_local_player(
    campaign_id: str,
    req: AddLocalPlayerRequest,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
) -> AddLocalPlayerResponse:
    """Add a local player to a campaign (for hot-seat multiplayer)."""
    if not req.player_name or not req.player_name.strip():
        raise HTTPException(status_code=400, detail="Player name is required")

    campaign = campaign_store.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status == "completed":
        raise HTTPException(status_code=400, detail="Campaign has ended")

    char_name = (req.character_name or req.player_name).strip()
    char_concept = (req.character_class or "Adventurer").strip()

    character_sheet = await _generate_character_sheet(
        char_name, char_concept, req.character_special, campaign, req.attribute_scores,
    )

    existing_players = player_store.get_by_campaign(campaign.id)
    turn_position = len(existing_players)

    player = player_store.create(
        campaign_id=campaign.id,
        name=req.player_name.strip(),
        session_token=x_session_token,
        character_sheet=character_sheet,
        is_gm=False,
        turn_position=turn_position,
    )

    new_turn_order = campaign.turn_order + [player.id]
    campaign_store.update(campaign.id, turn_order=new_turn_order)

    return AddLocalPlayerResponse(player=player)


@router.post("/{campaign_id}/players/batch", response_model=BatchAddPlayersResponse)
async def add_local_players_batch(
    campaign_id: str,
    req: BatchAddPlayersRequest,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
) -> BatchAddPlayersResponse:
    """Add multiple local players at once with parallel character generation."""
    if len(req.players) == 0:
        raise HTTPException(status_code=400, detail="At least one player is required")
    if len(req.players) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 players per batch")

    campaign = campaign_store.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status == "completed":
        raise HTTPException(status_code=400, detail="Campaign has ended")

    # Generate all character sheets in parallel
    generation_tasks = []
    for p in req.players:
        if not p.player_name or not p.player_name.strip():
            raise HTTPException(status_code=400, detail="All players must have a name")
        char_name = (p.character_name or p.player_name).strip()
        char_concept = (p.character_class or "Adventurer").strip()
        generation_tasks.append(
            _generate_character_sheet(char_name, char_concept, p.character_special, campaign, p.attribute_scores)
        )

    character_sheets = await asyncio.gather(*generation_tasks)

    # Create players sequentially (turn positions need ordering)
    existing_players = player_store.get_by_campaign(campaign.id)
    turn_position = len(existing_players)
    created_players = []

    for p, character_sheet in zip(req.players, character_sheets):
        player = player_store.create(
            campaign_id=campaign.id,
            name=p.player_name.strip(),
            session_token=x_session_token,
            character_sheet=character_sheet,
            is_gm=False,
            turn_position=turn_position,
        )
        created_players.append(player)
        turn_position += 1

    # Update turn order with all new players
    new_turn_order = campaign.turn_order + [p.id for p in created_players]
    campaign_store.update(campaign.id, turn_order=new_turn_order)

    return BatchAddPlayersResponse(players=created_players)


@router.delete("/{campaign_id}/players/{player_id}")
async def leave_campaign(
    campaign_id: str,
    player_id: str,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
):
    """Leave a campaign (or remove a player if GM)."""
    campaign = campaign_store.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    player = player_store.get(player_id)
    if not player or player.campaign_id != campaign_id:
        raise HTTPException(status_code=404, detail="Player not found in campaign")

    # Check permissions
    your_player = None
    if x_session_token:
        your_player = player_store.get_by_session_and_campaign(x_session_token, campaign_id)

    # Can remove self, or GM can remove others
    if not your_player:
        raise HTTPException(status_code=401, detail="Session token required")

    if your_player.id != player_id and not your_player.is_gm:
        raise HTTPException(status_code=403, detail="Only GM can remove other players")

    # Remove from turn order
    new_turn_order = [pid for pid in campaign.turn_order if pid != player_id]
    campaign_store.update(campaign_id, turn_order=new_turn_order)

    # Delete player
    player_store.delete(player_id)

    return {"ok": True}
