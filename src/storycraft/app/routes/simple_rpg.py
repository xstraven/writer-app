"""Simple RPG - Stateless LLM endpoints for frontend-only game state."""

from __future__ import annotations

import random
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from ..instructor_client import get_structured_llm_client
from ..openrouter import OpenRouterClient


router = APIRouter(prefix="/api/simple-rpg", tags=["simple-rpg"])


# --- Request/Response Models ---


class SimpleAttribute(BaseModel):
    name: str
    description: str


class GenerateAttributesRequest(BaseModel):
    world_setting: str
    model: Optional[str] = None


class GenerateAttributesResponse(BaseModel):
    attributes: List[SimpleAttribute]


class SimplePlayerInput(BaseModel):
    id: str
    player_name: str
    character_name: str
    concept: str
    attribute_scores: dict[str, int]  # { "Strength": 2, "Charisma": -1 }


class GenerateOpeningRequest(BaseModel):
    world_setting: str
    players: List[SimplePlayerInput]
    model: Optional[str] = None


class GenerateOpeningResponse(BaseModel):
    opening_scene: str
    suggested_actions: List[str]


class SimpleActionHistory(BaseModel):
    id: str
    type: str  # 'player_action' | 'gm_narration'
    player_id: Optional[str] = None
    player_name: Optional[str] = None
    content: str


class SimpleDiceResult(BaseModel):
    attribute_used: Optional[str]
    modifier: int
    roll: int  # 2d6 total
    total: int
    outcome: str  # 'full_success' | 'partial_success' | 'miss'


class ResolveActionRequest(BaseModel):
    world_setting: str
    action_history: List[SimpleActionHistory]
    player: SimplePlayerInput
    action: str
    all_players: List[SimplePlayerInput]
    model: Optional[str] = None


class ResolveActionResponse(BaseModel):
    narrative: str
    dice_result: Optional[SimpleDiceResult] = None
    suggested_actions: List[str]


# --- Dice mechanics ---


def roll_2d6() -> tuple[int, int, int]:
    """Roll 2d6 and return (die1, die2, total)."""
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


# --- Endpoints ---


@router.post("/generate-attributes", response_model=GenerateAttributesResponse)
async def generate_attributes(req: GenerateAttributesRequest) -> GenerateAttributesResponse:
    """Generate 3-5 attributes relevant to the adventure setting."""
    structured = get_structured_llm_client()

    class AttributeList(BaseModel):
        attributes: List[SimpleAttribute]

    prompt = f"""You are designing a simple tabletop RPG for a specific adventure setting.

ADVENTURE SETTING: {req.world_setting}

Generate 3-5 attributes (stats) that would be most relevant and fun for characters in this setting.

Guidelines:
- Keep it simple - these are for a family-friendly, narrative-focused game
- Choose attributes that fit the theme (e.g., a pirate adventure might have "Sailing", "Swordplay", "Charm")
- Each attribute should enable different types of actions
- Descriptions should be 1 sentence explaining when this attribute is used
- Avoid generic attributes like "Strength" unless they fit the specific setting

Examples of good themed attributes:
- For a wizard school: "Spellcasting", "Book Smarts", "Mischief", "Bravery"
- For pirates: "Seafaring", "Swordplay", "Charm", "Cunning"
- For superheroes: "Power", "Agility", "Smarts", "Heart"

Generate attributes that will make this adventure fun and thematic!"""

    try:
        result = await structured.create(
            response_model=AttributeList,
            messages=[
                {
                    "role": "system",
                    "content": "You create simple, fun RPG attributes for family-friendly adventures.",
                },
                {"role": "user", "content": prompt},
            ],
            model=req.model,
            temperature=0.8,
            max_retries=1,
            fallback=lambda: AttributeList(
                attributes=[
                    SimpleAttribute(
                        name="Courage",
                        description="Used when facing danger or standing up to challenges.",
                    ),
                    SimpleAttribute(
                        name="Cleverness",
                        description="Used for solving puzzles, making plans, and outsmarting others.",
                    ),
                    SimpleAttribute(
                        name="Heart",
                        description="Used for helping others, making friends, and staying positive.",
                    ),
                ]
            ),
        )
        return GenerateAttributesResponse(attributes=result.attributes)
    except Exception:
        return GenerateAttributesResponse(
            attributes=[
                SimpleAttribute(
                    name="Courage",
                    description="Used when facing danger or standing up to challenges.",
                ),
                SimpleAttribute(
                    name="Cleverness",
                    description="Used for solving puzzles, making plans, and outsmarting others.",
                ),
                SimpleAttribute(
                    name="Heart",
                    description="Used for helping others, making friends, and staying positive.",
                ),
            ]
        )


@router.post("/generate-opening", response_model=GenerateOpeningResponse)
async def generate_opening(req: GenerateOpeningRequest) -> GenerateOpeningResponse:
    """Generate an opening scene for the adventure."""
    client = OpenRouterClient()

    # Build party description
    party_lines = []
    for p in req.players:
        attr_str = ", ".join(
            f"{k}: {'+' if v >= 0 else ''}{v}" for k, v in p.attribute_scores.items()
        )
        party_lines.append(
            f"- {p.character_name} ({p.concept}) - played by {p.player_name} [{attr_str}]"
        )
    party_desc = "\n".join(party_lines)

    prompt = f"""You are the Game Master for a family-friendly tabletop adventure.

ADVENTURE SETTING:
{req.world_setting}

THE HEROES:
{party_desc}

Write an exciting opening scene (2-3 paragraphs) that:
1. Sets the scene and atmosphere
2. Introduces the heroes in an engaging way (mention each by name!)
3. Presents an immediate hook or situation that invites action
4. Ends with a moment that begs the question "What do you do?"

Keep it family-friendly, vivid, and fun! Use present tense.

After the scene, suggest 3-4 fun first actions the players might take."""

    messages = [
        {
            "role": "system",
            "content": "You are an enthusiastic Game Master for a family-friendly adventure. Keep things exciting, positive, and appropriate for all ages. Never include violence, scary content, or mature themes.",
        },
        {"role": "user", "content": prompt},
    ]

    try:
        gen = await client.chat(
            messages=messages,
            model=req.model,
            max_tokens=1024,
            temperature=0.85,
        )
        content = gen.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception:
        content = f"The adventure begins in {req.world_setting}. Our heroes - {', '.join(p.character_name for p in req.players)} - gather together, ready for excitement!"

    # Parse suggestions from the response (simple heuristic)
    # The LLM often lists them at the end
    suggested_actions = [
        "Look around and explore",
        "Talk to someone nearby",
        "Investigate something interesting",
        "Introduce yourself",
    ]

    # Try to extract suggestions if the LLM formatted them
    if content:
        lines = content.split("\n")
        for i, line in enumerate(lines):
            if any(
                marker in line.lower()
                for marker in ["suggest", "might", "could", "actions:", "options:"]
            ):
                # Try to get the next few lines as suggestions
                possible_suggestions = []
                for j in range(i + 1, min(i + 6, len(lines))):
                    cleaned = lines[j].strip().lstrip("-•*123456789.)").strip()
                    if cleaned and len(cleaned) > 3 and len(cleaned) < 100:
                        possible_suggestions.append(cleaned)
                if len(possible_suggestions) >= 2:
                    suggested_actions = possible_suggestions[:4]
                break

    return GenerateOpeningResponse(
        opening_scene=content,
        suggested_actions=suggested_actions,
    )


@router.post("/resolve-action", response_model=ResolveActionResponse)
async def resolve_action(req: ResolveActionRequest) -> ResolveActionResponse:
    """Resolve a player action, optionally rolling dice if needed."""
    structured = get_structured_llm_client()
    client = OpenRouterClient()

    # Build context from recent history
    history_lines = []
    for h in req.action_history[-15:]:  # Last 15 actions for context
        if h.type == "player_action":
            history_lines.append(f'{h.player_name}: "{h.content}"')
        else:
            history_lines.append(h.content)
    history_text = "\n\n".join(history_lines) if history_lines else "The adventure has just begun."

    # Build party description
    party_lines = []
    for p in req.all_players:
        party_lines.append(f"- {p.character_name} ({p.concept}) played by {p.player_name}")
    party_desc = "\n".join(party_lines)

    # Get attribute names from the player
    attr_names = list(req.player.attribute_scores.keys())

    # Step 1: Determine if dice roll is needed and which attribute
    class ActionAnalysis(BaseModel):
        needs_roll: bool = False
        attribute_used: Optional[str] = None
        why: str = ""

    analysis_prompt = f"""A player is taking an action in a family-friendly adventure game.

SETTING: {req.world_setting}

AVAILABLE ATTRIBUTES: {", ".join(attr_names)}

ACTION: {req.player.character_name} tries to: "{req.action}"

Should this action require a dice roll?

Answer YES if:
- There's meaningful uncertainty or risk
- The outcome could go interestingly different ways
- Success isn't guaranteed

Answer NO if:
- It's a simple action (talking, looking around, basic movement)
- It would be boring if it failed
- There's no real stakes or tension

If a roll IS needed, pick the most relevant attribute from the list above.
If no attribute fits well, you can specify null and the roll will be pure luck."""

    try:
        analysis = await structured.create(
            response_model=ActionAnalysis,
            messages=[
                {
                    "role": "system",
                    "content": "You decide when dice rolls add excitement to a family-friendly adventure.",
                },
                {"role": "user", "content": analysis_prompt},
            ],
            model=req.model,
            temperature=0.3,
            max_retries=1,
            fallback=lambda: ActionAnalysis(needs_roll=False),
        )
    except Exception:
        analysis = ActionAnalysis(needs_roll=False)

    # Step 2: Roll dice if needed
    dice_result: Optional[SimpleDiceResult] = None
    outcome_guidance = ""

    if analysis.needs_roll:
        d1, d2, roll_total = roll_2d6()

        # Get modifier from attribute if one was chosen
        modifier = 0
        attr_used = analysis.attribute_used
        if attr_used and attr_used in req.player.attribute_scores:
            modifier = req.player.attribute_scores[attr_used]

        total = roll_total + modifier
        outcome_type, outcome_desc = get_pbta_outcome(total)

        dice_result = SimpleDiceResult(
            attribute_used=attr_used,
            modifier=modifier,
            roll=roll_total,
            total=total,
            outcome=outcome_type,
        )

        # Build outcome guidance for narration
        if outcome_type == "full_success":
            outcome_guidance = f"""
DICE RESULT: 2d6={roll_total} + {modifier} ({attr_used or "luck"}) = {total} → FULL SUCCESS!
- {req.player.character_name} accomplishes their goal completely
- Add a small bonus or advantage
- Move the story forward positively"""
        elif outcome_type == "partial_success":
            outcome_guidance = f"""
DICE RESULT: 2d6={roll_total} + {modifier} ({attr_used or "luck"}) = {total} → PARTIAL SUCCESS
- {req.player.character_name} succeeds, but there's a twist or complication
- Present a difficult choice or unexpected development
- Keep things interesting!"""
        else:
            outcome_guidance = f"""
DICE RESULT: 2d6={roll_total} + {modifier} ({attr_used or "luck"}) = {total} → MISS (but keep it fun!)
- Things don't go as planned, but in an interesting way
- Create a new challenge or complication (NOT just "you fail")
- Keep it family-friendly - no serious harm, just setbacks and surprises
- This should push the story forward, not stop it"""

    # Step 3: Generate narrative
    narration_prompt = f"""You are the Game Master for a family-friendly adventure.

SETTING: {req.world_setting}

THE HEROES:
{party_desc}

STORY SO FAR:
{history_text}

NOW: {req.player.character_name} ({req.player.concept}) tries to: "{req.action}"
{outcome_guidance}

Write 1-2 short paragraphs narrating what happens:
- Address {req.player.character_name} by name
- Make it vivid and engaging
- Keep it family-friendly (no violence, scary content, or mature themes)
- End with something that invites the next action

Then suggest 3-4 fun things the players might do next."""

    try:
        gen = await client.chat(
            messages=[
                {
                    "role": "system",
                    "content": "You are a warm, enthusiastic Game Master for a family-friendly adventure. Keep everything positive, exciting, and appropriate for all ages.",
                },
                {"role": "user", "content": narration_prompt},
            ],
            model=req.model,
            max_tokens=800,
            temperature=0.8,
        )
        narrative = gen.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception:
        narrative = (
            f"{req.player.character_name} attempts to {req.action}. The adventure continues..."
        )

    # Parse suggested actions (same heuristic as opening)
    suggested_actions = [
        "Continue exploring",
        "Talk to someone",
        "Try something creative",
        "Help a friend",
    ]

    if narrative:
        lines = narrative.split("\n")
        for i, line in enumerate(lines):
            if any(
                marker in line.lower()
                for marker in ["suggest", "might", "could", "actions:", "options:", "next:"]
            ):
                possible_suggestions = []
                for j in range(i + 1, min(i + 6, len(lines))):
                    cleaned = lines[j].strip().lstrip("-•*123456789.)").strip()
                    if cleaned and len(cleaned) > 3 and len(cleaned) < 100:
                        possible_suggestions.append(cleaned)
                if len(possible_suggestions) >= 2:
                    suggested_actions = possible_suggestions[:4]
                break

    return ResolveActionResponse(
        narrative=narrative,
        dice_result=dice_result,
        suggested_actions=suggested_actions,
    )
