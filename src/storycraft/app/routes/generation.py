from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import (
    get_base_settings_store,
    get_lorebook_store,
    get_snippet_store,
    get_story_settings_store,
)
from ..editor_workflow import run_internal_editor_workflow
from ..lorebook_store import LorebookStore
from ..memory import continue_story, extract_memory_from_text, suggest_context_from_text
from ..models import (
    ContinueRequest,
    ContinueResponse,
    DevSeedRequest,
    DevSeedResponse,
    ExtractMemoryRequest,
    LoreEntryCreate,
    LoreGenerateRequest,
    LoreGenerateResponse,
    MemoryState,
    PromptPreviewRequest,
    PromptPreviewResponse,
    SeedStoryRequest,
    SeedStoryResponse,
    SuggestContextRequest,
)
from ..openrouter import OpenRouterClient
from ..prompt_builder import PromptBuilder
from ..services.experimental import internal_editor_enabled
from ..services.prompt_utils import merge_instruction, select_lore_items
from ..snippet_store import SnippetStore
from ..story_settings_store import StorySettingsStore
from ..base_settings_store import BaseSettingsStore


router = APIRouter()


@router.post("/api/extract-memory", response_model=MemoryState)
async def extract_memory(req: ExtractMemoryRequest) -> MemoryState:
    return await extract_memory_from_text(text=req.current_text, model=req.model, max_items=req.max_items)


def _truncate_text(draft_text: str, window_chars: Optional[int]) -> str:
    if not window_chars or window_chars <= 0:
        return draft_text
    try:
        window = int(window_chars)
    except Exception:
        return draft_text
    if window > 0 and len(draft_text) > window * 3:
        return draft_text[-(window * 3) :]
    return draft_text


def _gather_history_text(story: Optional[str], snippet_store: SnippetStore) -> str:
    if not story:
        return ""
    try:
        path = snippet_store.main_path(story)
        return snippet_store.build_text(path)
    except Exception:
        return ""


def _effective_lore_selection_text(draft_text: str, history_text: str) -> str:
    text = (draft_text or "").strip()
    if text:
        return text
    return (history_text or "").strip()


@router.post("/api/continue", response_model=ContinueResponse)
async def continue_endpoint(
    req: ContinueRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    lore_store: LorebookStore = Depends(get_lorebook_store),
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
) -> ContinueResponse:
    draft_text = req.draft_text or ""
    draft_text = _truncate_text(draft_text, getattr(req, "max_context_window", 0))

    history_text = ""
    if req.story:
        history_text = _gather_history_text(req.story, snippet_store)

    selection_text = _effective_lore_selection_text(draft_text, history_text)
    lore_items = select_lore_items(
        lore_store,
        story=req.story,
        explicit_ids=req.lore_ids,
        selection_text=selection_text,
    )

    mem: MemoryState | None = None
    if req.use_memory and draft_text.strip():
        mem = await extract_memory_from_text(text=draft_text, model=req.model)

    merged_instruction = merge_instruction(req.instruction, req.story, story_settings_store) or ""
    generation_kwargs = {
        "draft_text": req.draft_text,
        "instruction": merged_instruction,
        "mem": mem,
        "context": (req.context if req.use_context else None),
        "model": req.model,
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
        "history_text": history_text,
        "lore_items": lore_items,
        "system_prompt": req.system_prompt,
    }
    use_internal_editor = internal_editor_enabled(req.story, story_settings_store)

    try:
        if use_internal_editor:
            result = await run_internal_editor_workflow(
                generation_kwargs=generation_kwargs,
                user_instruction=req.instruction or "",
                story_so_far=history_text,
                draft_segment=req.draft_text or "",
                judge_model=req.model,
            )
        else:
            result = await continue_story(**generation_kwargs)
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")

    try:
        if req.story and not req.preview_only:
            story = req.story
            if not snippet_store.main_path(story) and req.draft_text.strip():
                snippet_store.create_snippet(
                    story=story, content=req.draft_text, kind="user", parent_id=None
                )
            main_path = snippet_store.main_path(story)
            parent_id = main_path[-1].id if main_path else None
            snippet_store.create_snippet(
                story=story,
                content=result.get("continuation", ""),
                kind="ai",
                parent_id=parent_id,
                set_active=True,
            )
    except Exception:
        pass
    return ContinueResponse(**result)


@router.post("/api/suggest-context")
async def suggest_context(req: SuggestContextRequest):
    ctx = await suggest_context_from_text(
        text=req.current_text,
        model=req.model,
        max_npcs=req.max_npcs,
        max_objects=req.max_objects,
    )
    return ctx


@router.post("/api/prompt-preview", response_model=PromptPreviewResponse)
async def prompt_preview(
    req: PromptPreviewRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    lore_store: LorebookStore = Depends(get_lorebook_store),
    story_settings: StorySettingsStore = Depends(get_story_settings_store),
) -> PromptPreviewResponse:
    history_text = ""
    if req.story:
        history_text = _gather_history_text(req.story, snippet_store)

    selection_text = _effective_lore_selection_text(req.draft_text or "", history_text)
    lore_items = select_lore_items(
        lore_store,
        story=req.story,
        explicit_ids=req.lore_ids,
        selection_text=selection_text,
    )

    mem: MemoryState | None = None
    if req.use_memory and (req.draft_text or "").strip():
        mem = await extract_memory_from_text(text=req.draft_text, model=req.model)

    sys_prompt = (req.system_prompt or "").strip() or (
        "You are an expert creative writing assistant. Continue the user's story in the same voice,"
        " tone, and perspective. Always preserve established canon, character continuity, and"
        " world-building details. If given instructions, apply them elegantly."
    )
    if req.use_memory:
        sys_prompt += "\nUse the provided Memory to maintain continuity."
    if req.use_context:
        sys_prompt += "\nIncorporate the Context details when plausible."

    merged_instr = merge_instruction(req.instruction, req.story, story_settings)
    messages = (
        PromptBuilder()
        .with_system(sys_prompt)
        .with_instruction(merged_instr or "")
        .with_lore(lore_items)
        .with_memory(mem)
        .with_context(req.context if req.use_context else None)
        .with_history_text(history_text)
        .with_draft_text(req.draft_text or "")
        .build_messages()
    )
    return PromptPreviewResponse(messages=messages)  # type: ignore[arg-type]


@router.post("/api/stories/seed-ai", response_model=SeedStoryResponse)
async def seed_story_from_prompt(
    req: SeedStoryRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    lore_store: LorebookStore = Depends(get_lorebook_store),
    story_settings: StorySettingsStore = Depends(get_story_settings_store),
) -> SeedStoryResponse:
    story = (req.story or "").strip()
    prompt = (req.prompt or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story name")
    if not prompt:
        raise HTTPException(status_code=400, detail="Missing prompt")

    opening_instruction = (
        "Write the opening scene for this story idea. Establish tone, POV, and a hook. "
        "Aim for 1–2 short paragraphs. Do not include meta commentary. Story idea: "
        + prompt
    )
    client = OpenRouterClient()
    messages = (
        PromptBuilder()
        .with_instruction(opening_instruction)
        .with_history_text("")
        .with_draft_text("")
        .build_messages()
    )
    gen = await client.chat(
        messages=messages,
        model=req.model,
        max_tokens=req.max_tokens_first_chunk,
        temperature=req.temperature,
    )
    content = gen.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    if not content:
        content = "[Starter]"

    row = snippet_store.create_snippet(
        story=story,
        content=content,
        kind="ai",
        parent_id=None,
        set_active=None,
    )

    synopsis = ""
    try:
        ctx = await suggest_context_from_text(text=content, model=req.model, max_npcs=4, max_objects=4)
        synopsis = (ctx.summary or "").strip()
        story_settings.update(story, {"synopsis": synopsis, "context": ctx.model_dump()})
    except Exception:
        synopsis = ""

    relevant_ids: list[str] = []
    if req.use_lore:
        try:
            selection_text = (prompt + "\n\n" + content)
            lore_entries = select_lore_items(
                lore_store,
                story=story,
                explicit_ids=[],
                selection_text=selection_text,
            )
            relevant_ids = [entry.id for entry in lore_entries]
        except Exception:
            relevant_ids = []

    return SeedStoryResponse(
        story=story,
        root_snippet_id=row.id,
        content=content,
        synopsis=synopsis,
        relevant_lore_ids=relevant_ids,
    )


@router.post("/api/lorebook/generate", response_model=LoreGenerateResponse)
async def generate_lorebook(
    req: LoreGenerateRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    lore_store: LorebookStore = Depends(get_lorebook_store),
) -> LoreGenerateResponse:
    story = (req.story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story")

    path = snippet_store.main_path(story)
    story_text = snippet_store.build_text(path)
    if not story_text.strip():
        story_text = ""

    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "kind": {"type": "string", "description": "character | location | item | faction | concept | note"},
                "summary": {"type": "string"},
                "tags": {"type": "array", "items": {"type": "string"}},
                "keys": {"type": "array", "items": {"type": "string"}},
                "always_on": {"type": "boolean"},
            },
            "required": ["name", "summary"],
            "additionalProperties": False,
        },
    }

    client = OpenRouterClient()
    names = [n.strip() for n in (req.names or []) if n and n.strip()]
    if names:
        names_block = "\n".join(f"- {n}" for n in names)
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a story bible generator. Given a list of entry names and the story text, "
                    "produce lore entries with the same names (do NOT rename). Infer kind, write a concise "
                    "summary (1-3 sentences), suggest tags and trigger keys, and set always_on true only if core canon."
                ),
            },
            {"role": "user", "content": "Names:\n" + names_block},
            {
                "role": "user",
                "content": ("Use the following story text as source (avoid invention beyond what's implied).\n\n" + story_text),
            },
        ]
    else:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a story bible generator. From the provided story text, extract a concise lorebook. "
                    "Return a JSON array where each item has: name, kind, summary, tags, keys, always_on. "
                    "- name: short unique label.\n- kind: character | location | item | faction | concept.\n"
                    "- summary: 1-3 sentences, factual.\n- tags: short labels.\n- keys: trigger words to auto-include.\n- always_on: true for core canon only."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Produce up to {max(1, int(req.max_items))} entries from this story text.\n\n" + story_text
                ),
            },
        ]

    result = await client.chat(
        messages=messages,
        model=req.model,
        temperature=0.2,
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "lore_entries", "schema": schema, "strict": False},
        },
    )

    created = 0
    try:
        content = result.get("choices", [{}])[0].get("message", {}).get("content")
        data = content if isinstance(content, list) else json.loads(content or "[]")
    except Exception:
        data = [
            {
                "name": "Synopsis",
                "kind": "note",
                "summary": (story_text[:200] + ("…" if len(story_text) > 200 else "")) or "Story synopsis placeholder.",
                "tags": ["auto"],
                "keys": [],
                "always_on": True,
            }
        ]

    if req.strategy == "replace":
        try:
            lore_store.delete_all(story)
        except Exception:
            pass

    existing = {(e.name.strip().lower(), (e.kind or "").strip().lower()) for e in lore_store.list(story)}
    for it in data or []:
        try:
            name = (it.get("name", "") or "").strip()
            summary = (it.get("summary", "") or "").strip()
            if not name or not summary:
                continue
            kind = (it.get("kind", "note") or "note").strip() or "note"
            key = (name.lower(), kind.lower())
            if key in existing and req.strategy != "replace":
                continue
            tags = it.get("tags") or []
            if not isinstance(tags, list):
                tags = []
            keys = it.get("keys") or []
            if not isinstance(keys, list):
                keys = []
            always_on = bool(it.get("always_on", False))
            created_entry = lore_store.create(
                LoreEntryCreate(
                    story=story,
                    name=name,
                    kind=kind,
                    summary=summary,
                    tags=[str(t) for t in tags if str(t).strip()],
                    keys=[str(k) for k in keys if str(k).strip()],
                    always_on=always_on,
                )
            )
            existing.add(key)
            if created_entry:
                created += 1
        except Exception:
            continue

    total = len(lore_store.list(story))
    return LoreGenerateResponse(story=story, created=created, total=total)


@router.post("/api/dev/seed", response_model=DevSeedResponse)
async def dev_seed(
    req: DevSeedRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    lore_store: LorebookStore = Depends(get_lorebook_store),
    story_settings: StorySettingsStore = Depends(get_story_settings_store),
    base_settings: BaseSettingsStore = Depends(get_base_settings_store),
) -> DevSeedResponse:
    def _slug(name: str) -> str:
        return "".join(c.lower() if c.isalnum() else "_" for c in name).strip("_") or "story"

    base = Path("data/samples")
    base.mkdir(parents=True, exist_ok=True)

    if req.purge:
        try:
            snippet_store.delete_all()
        except Exception:
            pass
        try:
            lore_store.delete_all_global()
        except Exception:
            pass
        try:
            story_settings.delete_all()
        except Exception:
            pass
    elif req.clear_existing:
        try:
            snippet_store.delete_story(req.story)
        except Exception:
            pass
        try:
            lore_store.delete_all(req.story)
        except Exception:
            pass
        try:
            story_settings.delete_story(req.story)
        except Exception:
            pass

    chunks_count = 0
    lore_count = 0

    fname = req.chunks_filename or (f"{_slug(req.story)}.txt")
    path_txt = base / fname
    if path_txt.exists():
        try:
            text = path_txt.read_text(encoding="utf-8")
            parts = [p.strip() for p in (text or "").split("\n\n")] if req.split_paragraphs else [text]
            parts = [p for p in parts if p]
            parent_id = None
            for chunk in parts:
                row = snippet_store.create_snippet(
                    story=req.story,
                    content=chunk,
                    kind="ai",
                    parent_id=parent_id,
                    set_active=parent_id is not None,
                )
                parent_id = row.id
                chunks_count += 1
        except Exception:
            pass

    lore_fname = req.lore_filename or (f"{_slug(req.story)}_lore.json")
    path_lore = base / lore_fname
    if path_lore.exists():
        try:
            data = json.loads(path_lore.read_text(encoding="utf-8"))
            if isinstance(data, list):
                for item in data:
                    try:
                        lec = LoreEntryCreate(
                            story=req.story,
                            name=item.get("name", ""),
                            kind=item.get("kind", "note") or "note",
                            summary=item.get("summary", ""),
                            tags=item.get("tags", []) or [],
                            keys=item.get("keys", []) or [],
                            always_on=bool(item.get("always_on", False)),
                        )
                        if lec.name and lec.summary:
                            lore_store.create(lec)
                            lore_count += 1
                    except Exception:
                        continue
        except Exception:
            pass

    base_defaults = base_settings.get()
    story_settings.update(
        req.story,
        {
            "model": base_defaults.get("model"),
            "temperature": base_defaults.get("temperature"),
            "max_tokens": base_defaults.get("max_tokens"),
        },
    )

    return DevSeedResponse(story=req.story, chunks_imported=chunks_count, lore_imported=lore_count)
