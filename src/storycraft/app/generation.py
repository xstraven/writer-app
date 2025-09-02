from __future__ import annotations

from typing import List, Optional, Tuple

from .models import ContextState, LoreEntry, MemoryState
from .prompt_builder import PromptBuilder
from .openrouter import OpenRouterClient
from .snippet_store import SnippetRow, SnippetStore
from . import memory as memory_mod


def collect_active_branch_until_head(
    *, story: str, head_id: Optional[str] = None, store: Optional[SnippetStore] = None
) -> Tuple[List[SnippetRow], str]:
    """Collect the active branch path and its concatenated text up to the given head.

    If head_id is None, uses the current main path head.
    Returns (path, text).
    """
    s = store or SnippetStore()
    if head_id:
        path = s.path_from_head(story, head_id)
    else:
        path = s.main_path(story)
    text = s.build_text(path)
    return path, text


async def generate_continuation_from_branch(
    *,
    story: str,
    head_id: Optional[str] = None,
    instruction: str = "",
    model: Optional[str] = None,
    max_tokens: int = 512,
    temperature: float = 0.7,
    use_memory: bool = True,
    context: Optional[ContextState] = None,
    use_context: bool = True,
    lore_items: Optional[list[LoreEntry]] = None,
    store: Optional[SnippetStore] = None,
) -> dict:
    """High-level workflow: gather active branch → build prompt → call OpenRouter.

    This does not persist snippets; it only returns the generation result.
    """
    # Collect the story so far from the active branch
    _, story_so_far = collect_active_branch_until_head(story=story, head_id=head_id, store=store)

    mem: Optional[MemoryState] = None
    if use_memory and story_so_far.strip():
        mem = await memory_mod.extract_memory_from_text(text=story_so_far, model=model)

    # Build messages via PromptBuilder
    messages = (
        PromptBuilder()
        .with_instruction(instruction)
        .with_lore(lore_items)
        .with_memory(mem)
        .with_context(context if use_context else None)
        .with_history_text(story_so_far)
        .with_draft_text("")
        .build_messages()
    )

    client = OpenRouterClient()
    resp = await client.chat(
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
    used_model = resp.get("model", model or client.default_model)
    return {"continuation": content, "model": used_model}

