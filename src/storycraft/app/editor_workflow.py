from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .memory import continue_story
from .openrouter import OpenRouterClient

JUDGE_SYSTEM_PROMPT = (
    "You are an impartial senior fiction editor. Review multiple candidate continuations for a "
    "serialised story. Identify how well each candidate satisfies the requested actions and story "
    "points, preserves continuity with the provided story so far, and maintains prose quality. "
    "Select the single best candidate."
)

CANDIDATE_COUNT = 4
_STORY_PREVIEW_CHARS = 2500
_DRAFT_PREVIEW_CHARS = 1200
_GENERATION_TIMEOUT = 180


async def run_internal_editor_workflow(
    *,
    generation_kwargs: Dict[str, Any],
    user_instruction: str,
    story_so_far: str,
    draft_segment: str,
    candidate_count: int = CANDIDATE_COUNT,
    judge_model: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate several candidates and pick the best one via an LLM judge."""

    count = max(1, candidate_count)
    candidates: List[Dict[str, Any]] = []
    for _ in range(count):
        result = await continue_story(**generation_kwargs, request_timeout=_GENERATION_TIMEOUT)
        candidates.append(result)

    if len(candidates) == 1:
        return candidates[0]

    completions = [c.get("continuation", "") for c in candidates]
    selection = await _select_best_candidate(
        completions=completions,
        user_instruction=user_instruction,
        merged_instruction=generation_kwargs.get("instruction", ""),
        story_so_far=story_so_far,
        draft_segment=draft_segment,
        model=judge_model,
    )

    winner = selection.get("winner")
    winner_index = _coerce_index(winner, len(candidates))
    return candidates[winner_index]


async def _select_best_candidate(
    *,
    completions: List[str],
    user_instruction: str,
    merged_instruction: str,
    story_so_far: str,
    draft_segment: str,
    model: Optional[str],
) -> Dict[str, Any]:
    client = OpenRouterClient()
    messages = [
        {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": _build_judge_prompt(
                completions=completions,
                user_instruction=user_instruction,
                merged_instruction=merged_instruction,
                story_so_far=story_so_far,
                draft_segment=draft_segment,
            ),
        },
    ]
    schema = {
        "name": "internal_editor_selection",
        "schema": {
            "type": "object",
            "properties": {
                "winner": {
                    "type": "integer",
                    "description": "Index (0-based) for the best candidate continuation.",
                },
                "reason": {
                    "type": "string",
                    "description": "Short explanation mentioning requested actions or story points.",
                },
                "scores": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "candidate": {"type": "integer"},
                            "instruction_coverage": {"type": "number"},
                            "continuity": {"type": "number"},
                            "quality": {"type": "number"},
                            "notes": {"type": "string"},
                        },
                        "required": [
                            "candidate",
                            "instruction_coverage",
                            "continuity",
                            "quality",
                        ],
                    },
                },
            },
            "required": ["winner"],
        },
        "strict": False,
    }

    response = await client.chat(
        messages=messages,
        model=model,
        temperature=0.0,
        max_tokens=512,
        response_format={"type": "json_schema", "json_schema": schema},
        timeout=180,
    )
    return _parse_selection(response)


def _build_judge_prompt(
    *,
    completions: List[str],
    user_instruction: str,
    merged_instruction: str,
    story_so_far: str,
    draft_segment: str,
) -> str:
    user_instruction = (user_instruction or "").strip()
    merged_instruction = (merged_instruction or "").strip()
    story_excerpt = _tail(story_so_far, _STORY_PREVIEW_CHARS)
    draft_excerpt = _tail(draft_segment, _DRAFT_PREVIEW_CHARS)

    lines: List[str] = []
    lines.append("Story so far (last characters shown):")
    lines.append(story_excerpt or "[no additional story context provided]")
    lines.append("")
    lines.append("Draft segment to continue:")
    lines.append(draft_excerpt or "[empty draft segment]")
    lines.append("")
    lines.append("User instruction / requested actions:")
    lines.append(user_instruction or "[no extra user instruction]")
    lines.append("")
    lines.append("Merged instruction provided to the generator:")
    lines.append(merged_instruction or "[default continuation guidance only]")
    lines.append("")
    lines.append(
        "Evaluate how completely each candidate covers the requested actions and story points, "
        "while keeping continuity and prose quality. If none fully satisfy the request, choose "
        "the option that addresses the most critical actions and feels most coherent."
    )
    lines.append("")
    lines.append("Candidates:")
    for idx, text in enumerate(completions):
        lines.append(f"Candidate {idx}:")
        lines.append(text.strip() or "[empty]")
        lines.append("---")
    lines.append("")
    lines.append(
        "Return a JSON object with: winner (0-based index), reason (short explanation), and "
        "optional scores per candidate (instruction_coverage, continuity, quality, notes)."
    )
    return "\n".join(lines)


def _parse_selection(response: Dict[str, Any]) -> Dict[str, Any]:
    try:
        content = response.get("choices", [{}])[0].get("message", {}).get("content", {})
        if isinstance(content, dict):
            return content
        return json.loads(content)
    except Exception:
        return {"winner": 0, "reason": "Judge response unparsable"}


def _coerce_index(value: Any, length: int) -> int:
    if not length:
        return 0
    try:
        idx = int(value)
    except Exception:
        return 0
    if idx < 0 or idx >= length:
        return 0
    return idx


def _tail(text: str, limit: int) -> str:
    text = (text or "").strip()
    if not text or limit <= 0:
        return text
    if len(text) <= limit:
        return text
    return text[-limit:]
