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
        self._preceding_text: str = ""
        self._following_text: str = ""

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

    def with_preceding_text(self, text: str) -> "PromptBuilder":
        """Set the text immediately before the section being rewritten (for context)."""
        self._preceding_text = text.strip()
        return self

    def with_following_text(self, text: str) -> "PromptBuilder":
        """Set the text immediately after the section being rewritten (for stitching context)."""
        self._following_text = text.strip()
        return self

    def build_messages(self) -> List[dict]:
        """Return OpenRouter-compatible chat messages list.

        Three-part structure:
        1) system: app/user-configurable system prompt
        2) user: current story context (prefer draft if provided, else history)
        3) user: meta section with story description, selected lore, optional memory, and PROMPT LAST
        """
        # Part 2: story context
        story_text = (self._draft_text or self._history_text).strip()
        story_msg = "[Story]\n" + story_text if story_text else ""

        # Part 3: meta + prompt + lore (+ optional memory)
        meta_parts: List[str] = []
        # Story description from context summary
        if self._context and getattr(self._context, "summary", "").strip():
            meta_parts.append("[Story Description]\n" + self._context.summary.strip())
        # Rich context details (NPCs, objects, etc.)
        context_block = _format_context(self._context)
        if context_block:
            meta_parts.append(context_block)
        # Selected lorebook entries
        lore_block = _format_lore(self._lore)
        if lore_block:
            meta_parts.append(lore_block)
        # Optional memory extraction to aid continuity
        mem_block = _format_memory(self._memory)
        if mem_block:
            meta_parts.append(mem_block)
        # Adjacent context for rewriting (helps LLM stitch text smoothly)
        if self._preceding_text:
            meta_parts.append("[Preceding Content]\n" + self._preceding_text)
        if self._following_text:
            meta_parts.append("[Following Content]\n" + self._following_text)
        # Prompt for generation (ALWAYS LAST). If not set, include a sensible default.
        prompt_text = (self._instruction or "").strip()
        if not prompt_text:
            prompt_text = (
                "Continue the story, matching established voice, tone, and point of view. "
                "Maintain continuity with prior events and details."
            )
        meta_parts.append("[Task]\n" + prompt_text)

        meta_msg = "\n\n".join(meta_parts).strip()

        messages: List[dict] = [{"role": "system", "content": self._system}]
        if story_msg:
            messages.append({"role": "user", "content": story_msg})
        if meta_msg:
            messages.append({"role": "user", "content": meta_msg})
        return messages


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
    if ctx.npcs:
        lines.append("NPCs:")
        for it in ctx.npcs:
            lines.append(f"- {it.label}: {it.detail}")
    if ctx.objects:
        lines.append("Objects:")
        for it in ctx.objects:
            lines.append(f"- {it.label}: {it.detail}")
    if len(lines) == 1:
        return ""
    return "\n".join(lines)


def _format_lore(items: Optional[List[LoreEntry]]) -> str:
    if not items:
        return ""
    lines: List[str] = ["[Lorebook]"]
    for it in items:
        tag_text = f" ({', '.join(it.tags)})" if it.tags else ""
        lines.append(f"- {it.name} [{it.kind}{tag_text}]: {it.summary}")
    return "\n".join(lines)
