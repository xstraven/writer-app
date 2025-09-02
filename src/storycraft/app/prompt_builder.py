from __future__ import annotations

from typing import List, Optional

from .models import ContextState, LoreEntry, MemoryState


class PromptBuilder:
    """Composable builder for chat prompts used for story generation.

    It supports adding instruction, memory, context, lorebook entries, and
    both a story history section (e.g., from the active branch) and a draft
    section (e.g., the current working text).
    """

    def __init__(self) -> None:
        self._system: str = (
            "You are an expert creative writing assistant. Continue the user's story in the same "
            "voice, tone, and perspective. Preserve canon, character continuity, and world details."
        )
        self._instruction: str = ""
        self._memory: Optional[MemoryState] = None
        self._context: Optional[ContextState] = None
        self._lore: Optional[List[LoreEntry]] = None
        self._history_text: str = ""
        self._draft_text: str = ""

    def with_system(self, text: str) -> "PromptBuilder":
        self._system = text
        return self

    def with_instruction(self, instruction: str) -> "PromptBuilder":
        self._instruction = instruction.strip()
        return self

    def with_memory(self, mem: Optional[MemoryState]) -> "PromptBuilder":
        self._memory = mem
        return self

    def with_context(self, ctx: Optional[ContextState]) -> "PromptBuilder":
        self._context = ctx
        return self

    def with_lore(self, items: Optional[List[LoreEntry]]) -> "PromptBuilder":
        self._lore = items
        return self

    def with_history_text(self, text: str) -> "PromptBuilder":
        self._history_text = text.strip()
        return self

    def with_draft_text(self, text: str) -> "PromptBuilder":
        self._draft_text = text.strip()
        return self

    def build_messages(self) -> List[dict]:
        """Return OpenRouter-compatible chat messages list."""
        user_parts: List[str] = []
        if self._instruction:
            user_parts.append(f"Instructions: {self._instruction}")

        lore_block = _format_lore(self._lore)
        if lore_block:
            user_parts.append(lore_block)

        mem_block = _format_memory(self._memory)
        if mem_block:
            user_parts.append(mem_block)

        ctx_block = _format_context(self._context)
        if ctx_block:
            user_parts.append(ctx_block)

        if self._history_text:
            user_parts.append("[History]\n" + self._history_text)

        # The draft section is what the model should explicitly continue from.
        if self._draft_text:
            user_parts.append("[Draft]\n" + self._draft_text)

        user_content = "\n\n".join(user_parts).strip()
        return [
            {"role": "system", "content": self._system},
            {"role": "user", "content": user_content},
        ]


def _format_memory(mem: Optional[MemoryState]) -> str:
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


def _format_context(ctx: Optional[ContextState]) -> str:
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


def _format_lore(items: Optional[List[LoreEntry]]) -> str:
    if not items:
        return ""
    lines: List[str] = ["[Lorebook]"]
    for it in items:
        tag_text = f" ({', '.join(it.tags)})" if it.tags else ""
        lines.append(f"- {it.name} [{it.kind}{tag_text}]: {it.summary}")
    return "\n".join(lines)

