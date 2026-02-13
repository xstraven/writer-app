"""
Shared character generation utilities for RPG games.

This module provides reusable functions for generating character sheets
using LLM, with fallback to default values. Can be used by both campaigns
and simple-rpg features.

Usage:
    from storycraft.app.character_generator import generate_character_sheet

    character = await generate_character_sheet(
        char_name="Thorin",
        char_concept="Brave warrior",
        char_special="Has a magic sword",
        world_setting="High fantasy realm",
        game_style="narrative",
        language="en",
    )
"""

from __future__ import annotations

from typing import Optional

from .instructor_client import get_structured_llm_client
from .models import CharacterSheet, CharacterAttribute, CharacterSkill, InventoryItem


async def generate_character_sheet(
    char_name: str,
    char_concept: str,
    char_special: Optional[str],
    world_setting: str,
    game_style: str = "narrative",
    tone: str = "all_ages",
    language: str = "en",
    model: Optional[str] = None,
) -> CharacterSheet:
    """
    Generate a character sheet using LLM with fallback to defaults.

    Args:
        char_name: Character's name
        char_concept: Character concept/class (e.g., "Brave knight", "Rogue")
        char_special: What makes them special (for narrative games)
        world_setting: The game world description
        game_style: "narrative" or "mechanical"
        tone: "family_friendly", "all_ages", or "mature"
        language: Language code ("en", "de", etc.)
        model: Optional LLM model override

    Returns:
        CharacterSheet with generated attributes, skills, etc.
    """
    structured = get_structured_llm_client()
    is_narrative = game_style == "narrative"

    # Language-specific prompt
    language_instructions = {
        "de": "WICHTIG: Antworte auf Deutsch.",
        "en": "IMPORTANT: Respond in English.",
    }.get(language, "IMPORTANT: Respond in English.")

    if is_narrative:
        # Narrative-style character (story-focused, no stats)
        special_line = f"\nWhat Makes Them Special: {char_special}" if char_special else ""
        char_prompt = f"""{language_instructions}

Create a character for a collaborative storytelling game.

Character Name: {char_name}
Character Concept: {char_concept}{special_line}

World: {world_setting}

Create a simple, memorable character with:
- A clear concept (one sentence describing who they are)
- What makes them special or unique (their gift, talent, or defining trait)
- A brief backstory (2-3 sentences) that connects them to the world
- NO numbered stats or attributes - this is a narrative game

Make them interesting and someone you'd want to go on an adventure with.
Keep it {tone} in tone."""

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
            return await structured.create(
                response_model=CharacterSheet,
                messages=[
                    {
                        "role": "system",
                        "content": "Create a character for a collaborative storytelling game. Focus on personality and story, not game mechanics.",
                    },
                    {"role": "user", "content": char_prompt},
                ],
                model=model,
                temperature=0.8,
                max_retries=2,
                fallback=lambda: default_char,
            )
        except Exception:
            return default_char

    else:
        # Mechanical-style character (D&D-like stats)
        char_prompt = f"""{language_instructions}

Create a character sheet for a {char_concept} named {char_name} in this world:

World: {world_setting}

Generate:
- 4-6 core attributes with values (8-18 range)
- 3-4 starting skills appropriate for their class
- Starting inventory (basic equipment)
- A brief backstory (2-3 sentences)

Keep it {tone} in tone."""

        # Default mechanical character
        default_attrs = [
            CharacterAttribute(name="Strength", value=12, max_value=20, description="Physical power"),
            CharacterAttribute(name="Agility", value=14, max_value=20, description="Speed and reflexes"),
            CharacterAttribute(name="Mind", value=10, max_value=20, description="Intelligence"),
            CharacterAttribute(name="Spirit", value=13, max_value=20, description="Willpower"),
        ]

        default_char = CharacterSheet(
            name=char_name,
            character_class=char_concept,
            level=1,
            health=20,
            max_health=20,
            attributes=default_attrs,
            skills=[
                CharacterSkill(name="Combat", level=1, description="Basic fighting ability"),
                CharacterSkill(name="Perception", level=1, description="Awareness"),
            ],
            inventory=[
                InventoryItem(name="Basic Weapon", item_type="weapon"),
                InventoryItem(name="Traveler's Pack", item_type="misc"),
            ],
            backstory=f"A {char_concept} seeking adventure.",
        )

        try:
            return await structured.create(
                response_model=CharacterSheet,
                messages=[
                    {
                        "role": "system",
                        "content": "Create a player character for a tabletop RPG.",
                    },
                    {"role": "user", "content": char_prompt},
                ],
                model=model,
                temperature=0.8,
                max_retries=2,
                fallback=lambda: default_char,
            )
        except Exception:
            return default_char
