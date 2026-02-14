"""Shared attribute generation utility for both Simple RPG and Campaign modes."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel

from .instructor_client import get_structured_llm_client
from .models import SimpleAttribute


DEFAULT_ATTRIBUTES = [
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


async def generate_attributes(
    world_setting: str,
    language: str = "en",
    model: Optional[str] = None,
) -> List[SimpleAttribute]:
    """Generate 3-5 themed attributes based on the adventure setting.

    Uses LLM to create attributes that fit the world. Falls back to
    generic defaults (Courage, Cleverness, Heart) on failure.
    """
    structured = get_structured_llm_client()

    class AttributeList(BaseModel):
        attributes: List[SimpleAttribute]

    language_instructions = {
        "de": "WICHTIG: Generiere alle Attributnamen und Beschreibungen auf Deutsch.",
        "en": "Generate all attribute names and descriptions in English.",
    }.get(language, "Generate all attribute names and descriptions in English.")

    prompt = f"""You are designing a simple tabletop RPG for a specific adventure setting.

{language_instructions}

ADVENTURE SETTING: {world_setting}

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
            model=model,
            temperature=0.8,
            max_retries=1,
            fallback=lambda: AttributeList(attributes=list(DEFAULT_ATTRIBUTES)),
        )
        return result.attributes
    except Exception:
        return list(DEFAULT_ATTRIBUTES)
