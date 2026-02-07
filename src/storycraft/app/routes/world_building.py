from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..instructor_client import get_structured_llm_client
from ..models import (
    ProposedLoreEntry,
    WorldAnalysisRequest,
    WorldAnalysisResponse,
    WorldConceptRequest,
    WorldConceptResponse,
    WorldExpandRequest,
    WorldExpandResponse,
    WorldQuestion,
)

router = APIRouter(prefix="/api/world-building", tags=["world-building"])


# --- Instructor response models (internal, used for structured LLM output) ---

class _AnalysisResult(BaseModel):
    summary: str = Field(description="2-3 sentence summary of what the AI understood about the world")
    detected_genre: str = Field(description="Primary genre (e.g., Fantasy, Sci-Fi, Horror, Historical)")
    detected_themes: List[str] = Field(description="Key themes identified in the description")
    questions: List[_QuestionItem] = Field(description="3-5 follow-up questions using concentric circles: core concept -> conflict -> locations -> factions -> flavor")
    proposed_entries: List[_LoreProposal] = Field(description="Key world elements that could become lorebook entries")


class _QuestionItem(BaseModel):
    question: str = Field(description="An open-ended, inspiring question about the world")
    category: str = Field(description="One of: conflict, setting, culture, magic, history, faction, character")
    placeholder: str = Field(description="A brief example answer to inspire the user")


class _LoreProposal(BaseModel):
    name: str
    kind: str = Field(description="One of: location, character, faction, item, concept")
    reason: str = Field(description="One sentence explaining why this is important to the world")


# Need to rebuild _AnalysisResult since _QuestionItem and _LoreProposal are defined after
class _AnalysisResult(BaseModel):
    summary: str = Field(description="2-3 sentence summary of what the AI understood about the world")
    detected_genre: str = Field(description="Primary genre (e.g., Fantasy, Sci-Fi, Horror, Historical)")
    detected_themes: List[str] = Field(description="Key themes identified in the description")
    questions: List[_QuestionItem] = Field(description="3-5 follow-up questions using concentric circles: core concept -> conflict -> locations -> factions -> flavor")
    proposed_entries: List[_LoreProposal] = Field(description="Key world elements that could become lorebook entries")


class _ExpandResult(BaseModel):
    enriched_description: str = Field(description="An enriched, cohesive world description incorporating all answers")
    follow_up_questions: List[_QuestionItem] = Field(description="2-4 deeper follow-up questions")
    proposed_entries: List[_LoreProposal] = Field(description="New world elements discovered from the answers")
    world_summary: dict = Field(default_factory=dict, description="Map of section names to summaries, e.g. 'Geography', 'Factions', 'Magic System'")


class _ConceptResult(BaseModel):
    name: str = Field(description="A creative name for the world or setting")
    description: str = Field(description="A vivid 3-5 sentence description of the world")
    genre: str = Field(description="The genre of this world")
    key_details: List[str] = Field(description="4-6 key details or hooks about this world")


# --- Endpoints ---

@router.post("/analyze", response_model=WorldAnalysisResponse)
async def analyze_world(req: WorldAnalysisRequest) -> WorldAnalysisResponse:
    """Analyze a world description and return targeted follow-up questions."""
    structured = get_structured_llm_client()

    tone_label = {
        "family_friendly": "family-friendly and appropriate for children",
        "all_ages": "suitable for all ages",
        "mature": "for mature audiences with realistic stakes",
    }.get(req.tone, "suitable for all ages")

    system_prompt = f"""You are a creative world-building assistant for tabletop RPGs.
Analyze the user's world description and identify what's established vs what's missing.

Ask questions using the "concentric circles" approach:
1. Core concept - What is this world really about?
2. Central conflict - What tension drives stories here?
3. Key locations - Where do adventures happen?
4. Factions/groups - Who are the major players?
5. Flavor details - What makes this world feel unique and alive?

Your questions should be:
- Open-ended and inspiring, never yes/no
- Specific to what the user has described (reference their details!)
- Designed to spark creativity, not interrogate

The tone should be {tone_label}. The game style is {req.style}.
Propose 3-6 lorebook entries for key world elements you can already identify."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Here is my world:\n\n{req.world_description}"},
    ]

    default = _AnalysisResult(
        summary=f"A world described as: {req.world_description[:200]}...",
        detected_genre="Fantasy",
        detected_themes=["adventure"],
        questions=[
            _QuestionItem(
                question="What is the central conflict or tension that drives stories in this world?",
                category="conflict",
                placeholder="An ancient evil is awakening, and the old heroes are gone...",
            ),
            _QuestionItem(
                question="Where do most adventures take place? Describe one key location in vivid detail.",
                category="setting",
                placeholder="The Sunken City, half-submerged ruins of a once-great civilization...",
            ),
            _QuestionItem(
                question="Who are the major factions or groups that shape this world?",
                category="faction",
                placeholder="The Iron Guild controls trade, while the Forest Wardens protect the wilds...",
            ),
        ],
        proposed_entries=[],
    )

    try:
        result = await structured.create(
            response_model=_AnalysisResult,
            messages=messages,
            model=req.model,
            temperature=0.8,
            max_retries=2,
            fallback=lambda: default,
        )
    except Exception:
        result = default

    # Convert internal models to API response models
    questions = [
        WorldQuestion(
            id=str(uuid.uuid4())[:8],
            question=q.question,
            category=q.category,
            placeholder=q.placeholder,
        )
        for q in result.questions
    ]

    proposed = [
        ProposedLoreEntry(name=e.name, kind=e.kind, reason=e.reason)
        for e in result.proposed_entries
    ]

    return WorldAnalysisResponse(
        summary=result.summary,
        questions=questions,
        detected_genre=result.detected_genre,
        detected_themes=result.detected_themes,
        proposed_entries=proposed,
    )


@router.post("/expand", response_model=WorldExpandResponse)
async def expand_world(req: WorldExpandRequest) -> WorldExpandResponse:
    """Take a world description + answers and return an enriched world."""
    structured = get_structured_llm_client()

    tone_label = {
        "family_friendly": "family-friendly and appropriate for children",
        "all_ages": "suitable for all ages",
        "mature": "for mature audiences with realistic stakes",
    }.get(req.tone, "suitable for all ages")

    # Format the answers into readable text
    answers_text = "\n".join(
        f"Q: {qid}\nA: {answer}" for qid, answer in req.answers.items()
    )

    system_prompt = f"""You are a creative world-building assistant for tabletop RPGs.
The user has described their world and answered some follow-up questions.
Your job is to weave everything together into a rich, cohesive world description.

Then ask 2-4 deeper follow-up questions that go further into the details.
Focus on aspects that would make the world come alive during gameplay.

The tone should be {tone_label}. The game style is {req.style}.

Also provide a structured world_summary with sections like "Geography", "Factions", "History", "Magic/Technology", etc.
And propose new lorebook entries for elements discovered from the answers."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Original world description:\n{req.world_description}\n\nAnswers to questions:\n{answers_text}"},
    ]

    default = _ExpandResult(
        enriched_description=req.world_description,
        follow_up_questions=[
            _QuestionItem(
                question="What everyday detail would a traveler notice first in this world?",
                category="culture",
                placeholder="The streets smell of spices and clockwork oil...",
            ),
        ],
        proposed_entries=[],
        world_summary={"Overview": req.world_description},
    )

    try:
        result = await structured.create(
            response_model=_ExpandResult,
            messages=messages,
            model=req.model,
            temperature=0.8,
            max_retries=2,
            fallback=lambda: default,
        )
    except Exception:
        result = default

    questions = [
        WorldQuestion(
            id=str(uuid.uuid4())[:8],
            question=q.question,
            category=q.category,
            placeholder=q.placeholder,
        )
        for q in result.follow_up_questions
    ]

    proposed = [
        ProposedLoreEntry(name=e.name, kind=e.kind, reason=e.reason)
        for e in result.proposed_entries
    ]

    return WorldExpandResponse(
        enriched_description=result.enriched_description,
        follow_up_questions=questions,
        proposed_entries=proposed,
        world_summary=result.world_summary,
    )


@router.post("/generate-concept", response_model=WorldConceptResponse)
async def generate_concept(req: WorldConceptRequest) -> WorldConceptResponse:
    """Generate a random world concept - the 'Surprise Me' feature."""
    structured = get_structured_llm_client()

    genre_hint = f"The genre should be: {req.genre}" if req.genre else "Pick any genre - surprise the user!"

    system_prompt = """You are a wildly creative world-building assistant.
Generate a unique, exciting world concept for a tabletop RPG.
Make it vivid, specific, and full of adventure hooks.
Avoid generic fantasy cliches - be creative and surprising!"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Generate a unique world concept for a tabletop RPG adventure. {genre_hint}\n\nMake it memorable and full of potential for stories!"},
    ]

    default = _ConceptResult(
        name="The Shattered Isles",
        description="A chain of floating islands drifting above an endless storm. Each island holds the remnants of a different civilization, connected by rope bridges and wind-sailing ships. The storm below occasionally spits up relics from a drowned world.",
        genre=req.genre or "Fantasy",
        key_details=[
            "Islands float above a perpetual lightning storm",
            "Each island has its own culture and secrets",
            "Wind-sailors navigate between the isles",
            "Relics from the drowned world below hold great power",
        ],
    )

    try:
        result = await structured.create(
            response_model=_ConceptResult,
            messages=messages,
            model=req.model,
            temperature=1.0,
            max_retries=2,
            fallback=lambda: default,
        )
    except Exception:
        result = default

    return WorldConceptResponse(
        name=result.name,
        description=result.description,
        genre=result.genre,
        key_details=result.key_details,
    )
