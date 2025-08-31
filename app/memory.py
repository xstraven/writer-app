from __future__ import annotations

from typing import Any, Dict, List, Optional

from .models import MemoryItem, MemoryState
from .openrouter import OpenRouterClient


MEMORY_EXTRACTION_SYSTEM = (
    "You are a story structure analyst. Extract the currently relevant characters, subplots, and"
    " concrete facts from the provided story text. Focus on details likely to guide the next 1-2"
    " scenes. Keep items concise and avoid spoilers or invention."
)


async def extract_memory_from_text(
    *,
    text: str,
    model: Optional[str] = None,
    max_items: int = 10,
) -> MemoryState:
    client = OpenRouterClient()

    schema = MemoryState.model_json_schema()

    messages = [
        {"role": "system", "content": MEMORY_EXTRACTION_SYSTEM},
        {
            "role": "user",
            "content": (
                "Extract memory from this story text. Limit total items to approximately "
                f"{max_items}.\n\n" + text
            ),
        },
    ]

    response = await client.chat(
        messages=messages,
        model=model,
        temperature=0.2,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "memory_state",
                "schema": schema,
                "strict": False,
            },
        },
    )

    # Attempt to parse assistant message content as JSON; fall back to empty state on failure.
    try:
        content = response["choices"][0]["message"]["content"]
        data = content if isinstance(content, dict) else None
        if data is None:
            import json as _json

            data = _json.loads(content)
        return MemoryState(**data)
    except Exception:
        return MemoryState()


CONTINUE_SYSTEM = (
    "You are an expert creative writing assistant. Continue the user's story in the same voice,"
    " tone, and perspective. Always preserve established canon, character continuity, and"
    " world-building details. If given instructions, apply them elegantly."
)


def _memory_block(mem: Optional[MemoryState]) -> str:
    if not mem:
        return ""
    lines: List[str] = ["[Memory]"]
    if mem.characters:
        lines.append("Characters:")
        for it in mem.characters:
            lines.append(f"- {it.label}: {it.detail}")
    if mem.subplots:
        lines.append("Subplots:")
        for it in mem.subplots:
            lines.append(f"- {it.label}: {it.detail}")
    if mem.facts:
        lines.append("Facts:")
        for it in mem.facts:
            lines.append(f"- {it.label}: {it.detail}")
    return "\n".join(lines)


async def continue_story(
    *, draft_text: str, instruction: str = "", mem: Optional[MemoryState] = None, model: Optional[str] = None, max_tokens: int = 512, temperature: float = 0.7
) -> Dict[str, str]:
    client = OpenRouterClient()
    memory = _memory_block(mem)
    sys = CONTINUE_SYSTEM
    if memory:
        sys += "\nUse the provided Memory to maintain continuity."
    messages = [
        {"role": "system", "content": sys},
        {
            "role": "user",
            "content": (
                (f"Instructions: {instruction}\n\n" if instruction else "")
                + (memory + "\n\n" if memory else "")
                + "[Draft]\n"
                + draft_text
            ),
        },
    ]
    resp = await client.chat(
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
    used_model = resp.get("model", model or client.default_model)
    return {"continuation": content, "model": used_model}

