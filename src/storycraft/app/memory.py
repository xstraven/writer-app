from __future__ import annotations

from typing import Dict, List, Optional

from .models import ContextState, LoreEntry, MemoryState, SuggestContextResponse
from .openrouter import OpenRouterClient
from .prompt_builder import PromptBuilder


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
    *,
    draft_text: str,
    instruction: str = "",
    mem: Optional[MemoryState] = None,
    context: Optional[ContextState] = None,
    model: Optional[str] = None,
    max_tokens: int = 512,
    temperature: float = 0.7,
    # New optional fields for future enrichment
    history_text: str = "",
    lore_items: Optional[List[LoreEntry]] = None,
    system_prompt: Optional[str] = None,
    request_timeout: Optional[float] = None,
) -> Dict[str, str]:
    client = OpenRouterClient()
    sys = system_prompt.strip() if system_prompt else CONTINUE_SYSTEM
    if mem:
        sys += "\nUse the provided Memory to maintain continuity."
    if context:
        sys += "\nIncorporate the Context details when plausible."
    messages = (
        PromptBuilder()
        .with_system(sys)
        .with_instruction(instruction)
        .with_lore(lore_items)
        .with_memory(mem)
        .with_context(context)
        .with_history_text(history_text)
        .with_draft_text(draft_text)
        .build_messages()
    )
    resp = await client.chat(
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=request_timeout,
    )
    content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
    used_model = resp.get("model", model or client.default_model)
    return {"continuation": content, "model": used_model}


def _context_block(ctx: Optional[ContextState]) -> str:
    if not ctx:
        return ""
    lines: List[str] = ["[Context]"]
    if ctx.summary:
        lines.append("Summary:")
        lines.append(ctx.summary.strip())
    if ctx.npcs:
        lines.append("NPCs:")
        for it in ctx.npcs:
            lines.append(f"- {it.label}: {it.detail}")
    if ctx.objects:
        lines.append("Objects:")
        for it in ctx.objects:
            lines.append(f"- {it.label}: {it.detail}")
    return "\n".join(lines)


CONTEXT_SUGGEST_SYSTEM = (
    "You are a scene analyst. Given story text, produce a concise current-scene summary,"
    " and list contextually relevant NPCs and physical objects that could influence the next scene."
    " Avoid inventing canon-breaking details; prefer what's implied or stated."
)


async def suggest_context_from_text(
    *, text: str, model: Optional[str] = None, max_npcs: int = 6, max_objects: int = 8
) -> SuggestContextResponse:
    client = OpenRouterClient()
    schema = ContextState.model_json_schema()
    schema.get("properties", {}).pop("system_prompt", None)
    required = schema.get("required")
    if isinstance(required, list) and "system_prompt" in required:
        schema["required"] = [field for field in required if field != "system_prompt"]
    messages = [
        {"role": "system", "content": CONTEXT_SUGGEST_SYSTEM},
        {
            "role": "user",
            "content": (
                "Analyze the following draft and respond with a JSON matching the schema.\n"
                f"Limit NPCs to about {max_npcs} and Objects to about {max_objects}.\n\n"
                + text
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
                "name": "context_state",
                "schema": schema,
                "strict": False,
            },
        },
    )
    try:
        content = response["choices"][0]["message"]["content"]
        data = content if isinstance(content, dict) else None
        if data is None:
            import json as _json

            data = _json.loads(content)
        ctx = ContextState(**data)
        return SuggestContextResponse(
            **ctx.model_dump(),
            system_prompt=CONTEXT_SUGGEST_SYSTEM,
        )
    except Exception:
        return SuggestContextResponse(system_prompt=CONTEXT_SUGGEST_SYSTEM)
