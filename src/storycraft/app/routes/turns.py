from __future__ import annotations

import random
import sys
import traceback
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
    CampaignAction,
    CampaignActionRequest,
    CampaignActionResponse,
    EndTurnRequest,
    RPGActionResult,
    TurnInfo,
)
from ..openrouter import OpenRouterClient
from ..player_store import PlayerStore
from ..prompt_builder import PromptBuilder


router = APIRouter(prefix="/api/campaigns", tags=["turns"])


def roll_dice(num_dice: int = 1, sides: int = 20) -> int:
    """Roll dice and return the total."""
    return sum(random.randint(1, sides) for _ in range(num_dice))


def roll_2d6() -> tuple[int, int, int]:
    """Roll 2d6 and return (die1, die2, total) for PbtA-style resolution."""
    d1, d2 = random.randint(1, 6), random.randint(1, 6)
    return d1, d2, d1 + d2


def get_pbta_outcome(total: int) -> tuple[str, str]:
    """Get PbtA-style outcome from 2d6 roll.
    Returns (outcome_type, description)
    """
    if total >= 10:
        return "full_success", "full success"
    elif total >= 7:
        return "partial_success", "success with a complication"
    else:
        return "miss", "things get complicated"


def get_attribute_modifier(value: int) -> int:
    """Calculate D&D-style attribute modifier."""
    return (value - 10) // 2


@router.get("/{campaign_id}/turn", response_model=TurnInfo)
async def get_turn_info(
    campaign_id: str,
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
) -> TurnInfo:
    """Get current turn information."""
    campaign = campaign_store.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    players = player_store.get_by_campaign(campaign_id)
    player_names = {p.id: p.name for p in players}

    current_player_name = None
    if campaign.current_turn_player_id:
        current_player_name = player_names.get(campaign.current_turn_player_id)

    return TurnInfo(
        campaign_id=campaign_id,
        current_player_id=campaign.current_turn_player_id,
        current_player_name=current_player_name,
        turn_number=campaign.turn_number,
        turn_order=campaign.turn_order,
        player_names=player_names,
    )


@router.get("/{campaign_id}/history", response_model=List[CampaignAction])
async def get_action_history(
    campaign_id: str,
    limit: Optional[int] = None,
    action_store: CampaignActionStore = Depends(get_campaign_action_store),
) -> List[CampaignAction]:
    """Get action history for a campaign."""
    if limit:
        return action_store.get_recent(campaign_id, limit=limit)
    return action_store.get_by_campaign(campaign_id)


@router.post("/{campaign_id}/action", response_model=CampaignActionResponse)
async def take_action(
    campaign_id: str,
    req: CampaignActionRequest,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
    action_store: CampaignActionStore = Depends(get_campaign_action_store),
) -> CampaignActionResponse:
    """Take an action in the campaign."""
    campaign = campaign_store.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status != "active":
        raise HTTPException(status_code=400, detail="Campaign is not active")

    # Get player
    player = player_store.get(req.player_id)
    if not player or player.campaign_id != campaign_id:
        raise HTTPException(status_code=404, detail="Player not found in campaign")

    # Verify it's the player's turn
    if campaign.current_turn_player_id != req.player_id:
        raise HTTPException(status_code=403, detail="It's not your turn")

    # Verify session owns this player
    if x_session_token and player.session_token != x_session_token:
        raise HTTPException(status_code=403, detail="Not your player")

    if not req.action or not req.action.strip():
        raise HTTPException(status_code=400, detail="Action is required")

    character = player.character_sheet
    game_system = campaign.game_system

    # Get story context
    context_text = action_store.get_narrative_context(campaign_id, max_chars=4000)

    # Determine if action needs dice rolls based on game style
    action_results = []
    roll_outcome = None
    outcome_type = None

    # Check game style - narrative games use PbtA-style 2d6, mechanical use d20
    is_narrative_style = game_system and game_system.style == "narrative"

    if req.use_dice and game_system:
        structured = get_structured_llm_client()

        if is_narrative_style:
            # PbtA-style: check if the action is risky/uncertain
            check_prompt = f"""In this collaborative story, a player is attempting an action.

Action: {req.action}

Story so far: {context_text[-1000:] if context_text else 'The adventure begins.'}

Should this action have uncertain outcomes? Answer yes if:
- There's meaningful risk or stakes
- Failure would be interesting (not just boring)
- The outcome genuinely could go either way

Answer no if:
- It's a simple action anyone could do
- There's no real tension or stakes
- Failing would just slow down the story unnecessarily

Remember: we want the story to flow. Only roll when it makes the moment more exciting."""

            class NarrativeCheckAnalysis(BaseModel):
                needs_roll: bool = False
                why: str = ""  # Brief reason for the decision

            try:
                check_analysis = await structured.create(
                    response_model=NarrativeCheckAnalysis,
                    messages=[
                        {"role": "system", "content": "You help decide when dice rolls add to the story in a collaborative narrative game."},
                        {"role": "user", "content": check_prompt},
                    ],
                    model=req.model,
                    temperature=0.3,
                    max_retries=1,
                    fallback=lambda: NarrativeCheckAnalysis(needs_roll=False),
                )
            except Exception:
                check_analysis = NarrativeCheckAnalysis(needs_roll=False)

            if check_analysis.needs_roll:
                # Roll 2d6 for PbtA-style outcome
                d1, d2, total = roll_2d6()
                outcome_type, outcome_desc = get_pbta_outcome(total)

                action_results.append(RPGActionResult(
                    check_type="Story Moment",
                    target_number=7,  # For reference
                    roll_result=total,
                    modifier=0,
                    total=total,
                    success=outcome_type != "miss",
                    description=outcome_desc,  # Hide the numbers, show the drama
                ))
                roll_outcome = outcome_type
        else:
            # Traditional d20 mechanical check
            check_prompt = f"""Analyze this player action and determine what dice check(s) are needed:

Action: {req.action}

Character: {character.name if character else 'Unknown'} ({character.character_class if character else ''})
Attributes: {', '.join(f'{a.name}: {a.value}' for a in (character.attributes if character else []))}

Game System: {game_system.name}
Core Mechanic: {game_system.core_mechanic}
Difficulty Levels: {game_system.difficulty_levels}

If the action requires a check, specify:
- check_type: The type of check (e.g., "Strength check", "Stealth check")
- target_number: The difficulty target to beat
- attribute_used: Which attribute to use

If no check is needed (simple actions like talking, moving in safe areas), set needs_check to false."""

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

            if check_analysis.needs_check and character:
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

    # Get all player info for context
    players = player_store.get_by_campaign(campaign_id)
    party_info = []
    for p in players:
        if p.character_sheet:
            char = p.character_sheet
            if is_narrative_style:
                # For narrative games, describe who they are
                party_info.append(f"- {char.name}: {char.concept or char.character_class} (played by {p.name})")
            else:
                party_info.append(f"- {char.name} ({char.character_class}), played by {p.name}")

    # Build tone-appropriate system prompt
    tone = game_system.tone if game_system else "all_ages"
    tone_guidance = {
        "family_friendly": "This is a family-friendly adventure suitable for children. Keep content positive and age-appropriate. No violence, scary imagery, or mature themes. Focus on teamwork, problem-solving, and wonder.",
        "all_ages": "This is an all-ages adventure. Keep content appropriate for everyone, with mild adventure peril but nothing too scary or violent.",
        "mature": "This is a mature adventure with realistic stakes and consequences.",
    }.get(tone, "This is an all-ages adventure.")

    if is_narrative_style:
        # Narrative-focused GM prompt with PbtA principles
        gm_principles = game_system.gm_principles if game_system and game_system.gm_principles else [
            "Say 'yes, and...' to build on player ideas",
            "Ask questions and use the answers",
            "Make the world feel alive",
            "Give every character a chance to shine",
        ]

        outcome_guidance = ""
        if roll_outcome == "full_success":
            outcome_guidance = """
The player rolled a FULL SUCCESS. They accomplish what they set out to do, and maybe a little more.
- Let them describe how they succeed
- Give them a small bonus or advantage
- Move the story forward positively"""
        elif roll_outcome == "partial_success":
            outcome_guidance = """
The player rolled a PARTIAL SUCCESS. They get what they want, but there's a complication.
- They succeed, but at a cost
- Present a difficult choice
- Introduce an unexpected twist
- Something is gained, something is complicated"""
        elif roll_outcome == "miss":
            outcome_guidance = """
The player rolled a MISS. Things get more complicated, but in an interesting way.
- Don't just say "you fail" - make something happen
- Introduce a new problem or complication
- Reveal something unexpected
- The world reacts in a way that raises the stakes
- This should push the story forward, not stop it"""

        narrative_prompt = f"""You are the Game Master for a collaborative storytelling game. A player has taken an action. Narrate what happens next.

YOUR PRINCIPLES AS GM:
{chr(10).join(f'- {p}' for p in gm_principles)}

TONE: {tone_guidance}

WORLD: {campaign.world_setting}

THE PARTY:
{chr(10).join(party_info)}

STORY SO FAR:
{context_text}

{player.name}'s CHARACTER: {character.name if character else player.name}
{f"({character.concept or character.character_class})" if character else ""}
{f"Special: {character.special_trait}" if character and character.special_trait else ""}

WHAT THEY TRY TO DO: {req.action}
{outcome_guidance}

Write 1-3 paragraphs that:
1. Build on the player's action with "yes, and..." energy
2. Make the world feel alive and reactive
3. End with something that invites the next player or action
4. Include opportunities for other characters to contribute

Keep it engaging, collaborative, and moving forward. Don't lecture or explain - just tell the story!"""

        system_content = f"You are a warm, engaging Game Master for a collaborative storytelling game. {tone_guidance} Focus on fun, collaboration, and keeping the story moving. Use 'yes, and...' to build on player ideas. Keep responses concise but vivid."
    else:
        # Traditional mechanical GM prompt
        roll_info = ""
        if action_results:
            roll_info = "\n\nDice Roll Results:\n" + "\n".join(
                f"- {r.check_type}: {r.description}" for r in action_results
            )

        narrative_prompt = f"""You are the Game Master for a multiplayer tabletop RPG. A player has taken an action. Narrate the result.

World Setting: {campaign.world_setting}

Party Members:
{chr(10).join(party_info)}

Acting Character: {character.name if character else 'Unknown'}, {character.character_class if character else ''}
(Played by: {player.name})

Recent Story Context:
{context_text}

{player.name}'s Action: {req.action}
{roll_info}

Write 1-3 paragraphs describing what happens. Be vivid and engaging.
If there were dice results, incorporate the success or failure naturally into the narrative.
Address {character.name if character else player.name} directly when relevant, but keep it readable for all players.
End by describing the situation the party now faces."""

        system_content = f"You are an engaging Game Master narrating a multiplayer tabletop RPG. {tone_guidance} Be descriptive but concise."

    narrative_messages = (
        PromptBuilder()
        .with_system(system_content)
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
        narrative = f"{character.name if character else player.name} attempts to {req.action}. The result is uncertain..."

    if not narrative:
        narrative = f"{character.name if character else player.name} attempts to {req.action}..."

    # Record the player action
    player_action_record = action_store.create(
        campaign_id=campaign_id,
        action_type="player_action",
        content=req.action,
        player_id=player.id,
        action_results=action_results,
        turn_number=campaign.turn_number,
    )

    # Record the GM narrative
    action_store.create(
        campaign_id=campaign_id,
        action_type="gm_narration",
        content=narrative,
        player_id=None,
        turn_number=campaign.turn_number,
    )

    # Update player activity
    player_store.touch_activity(player.id)

    # Generate contextual action suggestions based on game style
    if is_narrative_style:
        # For narrative games, suggest story-focused actions
        available_actions = [
            "What do you do next?",
            "Talk to someone in your group",
            "Look around and explore",
            "Try something creative!",
        ]
    else:
        available_actions = [
            "Continue exploring",
            "Talk to your companions",
            "Investigate further",
            "Rest and recover",
        ]

    return CampaignActionResponse(
        action=player_action_record,
        narrative=narrative,
        action_results=action_results,
        character_updates=None,
        available_actions=available_actions,
        quest_update="",
    )


@router.post("/{campaign_id}/end-turn", response_model=TurnInfo)
async def end_turn(
    campaign_id: str,
    req: EndTurnRequest,
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    campaign_store: CampaignStore = Depends(get_campaign_store),
    player_store: PlayerStore = Depends(get_player_store),
    action_store: CampaignActionStore = Depends(get_campaign_action_store),
) -> TurnInfo:
    """End the current turn and advance to the next player."""
    campaign = campaign_store.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status != "active":
        raise HTTPException(status_code=400, detail="Campaign is not active")

    # Verify it's the player's turn
    if campaign.current_turn_player_id != req.player_id:
        raise HTTPException(status_code=403, detail="It's not your turn")

    # Verify session owns this player
    player = player_store.get(req.player_id)
    if x_session_token and player and player.session_token != x_session_token:
        raise HTTPException(status_code=403, detail="Not your player")

    # Record turn end
    action_store.create(
        campaign_id=campaign_id,
        action_type="system",
        content=f"{player.name if player else 'Player'} ended their turn.",
        player_id=req.player_id,
        turn_number=campaign.turn_number,
    )

    # Advance to next player
    campaign = campaign_store.advance_turn(campaign_id)

    players = player_store.get_by_campaign(campaign_id)
    player_names = {p.id: p.name for p in players}

    current_player_name = None
    if campaign.current_turn_player_id:
        current_player_name = player_names.get(campaign.current_turn_player_id)

    return TurnInfo(
        campaign_id=campaign_id,
        current_player_id=campaign.current_turn_player_id,
        current_player_name=current_player_name,
        turn_number=campaign.turn_number,
        turn_order=campaign.turn_order,
        player_names=player_names,
    )
