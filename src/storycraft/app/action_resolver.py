"""
Shared action resolution utilities for RPG games.

Provides reusable functions for resolving player actions with dice rolls
and narrative generation. Can be used by both campaigns and simple-rpg.

Usage:
    from storycraft.app.action_resolver import roll_2d6, resolve_pbta_outcome

    roll_result = roll_2d6()
    outcome = resolve_pbta_outcome(roll_result[2] + modifier)
"""

from __future__ import annotations

import random
from typing import Tuple


def roll_2d6() -> Tuple[int, int, int]:
    """
    Roll 2d6 and return individual dice and total.

    Returns:
        Tuple of (die1, die2, total)
    """
    d1, d2 = random.randint(1, 6), random.randint(1, 6)
    return d1, d2, d1 + d2


def roll_d20() -> int:
    """Roll 1d20 and return result."""
    return random.randint(1, 20)


def resolve_pbta_outcome(total: int) -> Tuple[str, str]:
    """
    Resolve Powered by the Apocalypse style outcome from 2d6 roll.

    Args:
        total: 2d6 roll + modifiers

    Returns:
        Tuple of (outcome_type, description)
        - "full_success": 10+ (full success)
        - "partial_success": 7-9 (success with complication)
        - "miss": 6- (things get worse)
    """
    if total >= 10:
        return "full_success", "full success"
    elif total >= 7:
        return "partial_success", "success with a complication"
    else:
        return "miss", "things get complicated"


def resolve_d20_check(roll: int, modifier: int, difficulty: int) -> Tuple[bool, int]:
    """
    Resolve a d20 check against difficulty (D&D-style).

    Args:
        roll: The d20 roll (1-20)
        modifier: Attribute/skill modifier to add
        difficulty: Target number to beat

    Returns:
        Tuple of (success, total)
    """
    total = roll + modifier
    return total >= difficulty, total


def get_difficulty_dc(difficulty_level: str) -> int:
    """
    Get difficulty class for named difficulty levels.

    Args:
        difficulty_level: "easy", "medium", "hard", "heroic"

    Returns:
        DC value (8-20)
    """
    difficulties = {
        "easy": 8,
        "medium": 12,
        "hard": 16,
        "heroic": 20,
    }
    return difficulties.get(difficulty_level.lower(), 12)
