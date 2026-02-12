"""
Shared opening scene generation utilities for RPG games.

This module provides reusable functions for generating opening scenes
and initial suggested actions using LLM. Can be used by both campaigns
and simple-rpg features.

Usage:
    from storycraft.app.opening_generator import generate_opening_scene

    result = await generate_opening_scene(
        world_setting="A dark forest",
        players=[...],
        game_style="narrative",
        language="en",
    )
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel

from .openrouter import OpenRouterClient


class Player(BaseModel):
    """Generic player representation for opening generation."""

    character_name: str
    concept: str
    player_name: str


class OpeningSceneResult(BaseModel):
    """Result of opening scene generation."""

    opening_scene: str
    suggested_actions: List[str]


async def generate_opening_scene(
    world_setting: str,
    players: List[Player],
    game_style: str = "narrative",
    tone: str = "all_ages",
    language: str = "en",
    model: Optional[str] = None,
) -> OpeningSceneResult:
    """
    Generate an opening scene for an RPG adventure.

    Args:
        world_setting: Description of the game world
        players: List of players with character names and concepts
        game_style: "narrative", "mechanical", or "simple"
        tone: "family_friendly", "all_ages", or "mature"
        language: Language code ("en", "de", etc.)
        model: Optional LLM model override

    Returns:
        OpeningSceneResult with opening scene text and suggested actions
    """
    client = OpenRouterClient()

    # Build party description
    party_lines = []
    for p in players:
        party_lines.append(
            f"- {p.character_name} ({p.concept}) - played by {p.player_name}"
        )
    party_desc = "\n".join(party_lines)

    # Language-specific instructions
    language_instructions = {
        "de": "WICHTIG: Schreibe die gesamte Eröffnungsszene und alle Aktionsvorschläge auf Deutsch.",
        "en": "Write the entire opening scene and action suggestions in English.",
    }.get(language, "Write the entire opening scene and action suggestions in English.")

    # Tone-specific guidance
    tone_guidance = {
        "family_friendly": "Keep it family-friendly and appropriate for children. No violence, scary content, or mature themes.",
        "all_ages": "Keep it suitable for all ages with mild adventure peril but nothing too scary or violent.",
        "mature": "You may include realistic consequences and dramatic tension appropriate for mature audiences.",
    }.get(tone, "Keep it suitable for all ages.")

    prompt = f"""{language_instructions}

You are the Game Master for a tabletop adventure.

ADVENTURE SETTING:
{world_setting}

THE HEROES:
{party_desc}

{tone_guidance}

Write an exciting opening scene (2-3 paragraphs) that:
1. Sets the scene and atmosphere
2. Introduces the heroes in an engaging way (mention each by name!)
3. Presents an immediate hook or situation that invites action
4. Ends with a moment that begs the question "What do you do?"

Use present tense and make it vivid and fun!

After the scene, suggest 3-4 fun first actions the players might take."""

    system_content = (
        "You are an enthusiastic Game Master for a tabletop adventure. "
        "Keep things exciting, positive, and engaging. "
        f"{tone_guidance}"
    )

    try:
        gen = await client.chat(
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt},
            ],
            model=model,
            max_tokens=1024,
            temperature=0.85,
        )
        content = gen.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception:
        content = f"The adventure begins in {world_setting}. Our heroes - {', '.join(p.character_name for p in players)} - gather together, ready for excitement!"

    # Parse suggested actions (simple heuristic)
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
                for marker in ["suggest", "might", "could", "actions:", "options:", "next:"]
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

    return OpeningSceneResult(
        opening_scene=content,
        suggested_actions=suggested_actions,
    )
