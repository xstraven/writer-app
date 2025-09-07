from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .memory import continue_story, extract_memory_from_text, suggest_context_from_text
import sys, traceback
from .models import (
    AppPersistedState,
    ContinueRequest,
    ContinueResponse,
    ExtractMemoryRequest,
    HealthResponse,
    BranchPathResponse,
    LoreEntry,
    LoreEntryCreate,
    LoreEntryUpdate,
    MemoryState,
    AppendSnippetRequest,
    RegenerateSnippetRequest,
    ChooseActiveChildRequest,
    RegenerateAIRequest,
    Snippet,
    SuggestContextRequest,
    UpdateSnippetRequest,
    InsertAboveRequest,
    InsertBelowRequest,
    DeleteSnippetResponse,
    TreeResponse,
    TreeRow,
    BranchInfo,
    UpsertBranchRequest,
    PromptPreviewRequest,
    PromptPreviewResponse,
    DevSeedRequest,
    DevSeedResponse,
    SeedStoryRequest,
    SeedStoryResponse,
    LoreGenerateRequest,
    LoreGenerateResponse,
)


settings = get_settings()
app = FastAPI(title="Storycraft API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .runtime import lorebook_store as store
from .runtime import state_store, base_settings_store, snippet_store, story_settings_store


from .routes.health import router as health_router
from .routes.state import router as state_router
from .routes.story_settings import router as story_settings_router
from .routes.lorebook import router as lorebook_router

app.include_router(health_router)
app.include_router(state_router)
app.include_router(story_settings_router)
app.include_router(lorebook_router)


# lorebook endpoints moved to router


@app.post("/api/extract-memory", response_model=MemoryState)
async def extract_memory(req: ExtractMemoryRequest) -> MemoryState:
    return await extract_memory_from_text(text=req.current_text, model=req.model, max_items=req.max_items)


@app.post("/api/continue", response_model=ContinueResponse)
async def continue_endpoint(req: ContinueRequest) -> ContinueResponse:
    # Apply optional max context window to draft text (truncate from top)
    draft_text = req.draft_text or ""
    try:
        win_c = int(getattr(req, "max_context_window", 0) or 0)
        if win_c > 0 and len(draft_text) > win_c * 3:
            draft_text = draft_text[-(win_c * 3) :]
    except Exception:
        pass

    mem: MemoryState | None = None
    if req.use_memory and draft_text.strip():
        mem = await extract_memory_from_text(text=draft_text, model=req.model)
    # Select lorebook entries: union of explicit IDs + auto by keys + always_on.
    lore_items = []
    explicit_ids = set(req.lore_ids or [])
    # Build selection text from draft or history (prefer draft).
    selection_text = (draft_text or "").strip() or ""
    if not selection_text:
        # Fallback to history gathered below if draft empty; else leave blank.
        selection_text = ""

    # If a story id is provided, pass the active branch text as history to the prompt.
    history_text = ""
    if req.story:
        try:
            path = snippet_store.main_path(req.story)
            history_text = snippet_store.build_text(path)
        except Exception:
            history_text = ""
        if not selection_text:
            selection_text = history_text or ""
    # Auto-select lore: include any entry with always_on or key match (scoped to story).
    try:
        text_lower = selection_text.lower()[-4000:]
        # Only consider lore for the current story when provided
        lore_source = store.list(req.story) if req.story else []
        for entry in lore_source:
            if entry.id in explicit_ids:
                lore_items.append(entry)
                continue
            if getattr(entry, "always_on", False):
                lore_items.append(entry)
                continue
            keys = [k.strip().lower() for k in getattr(entry, "keys", []) if k and k.strip()]
            if keys and any(k in text_lower for k in keys):
                lore_items.append(entry)
    except Exception:
        # On any failure, fall back to explicit-only
        if not lore_items and explicit_ids:
            for _id in explicit_ids:
                entry = store.get(_id)
                if entry:
                    lore_items.append(entry)

    try:
        result = await continue_story(
            draft_text=req.draft_text,
            instruction=_merge_instruction(req.instruction, req.story) or "",
            mem=mem,
            context=(req.context if req.use_context else None),
            model=req.model,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            history_text=history_text,
            lore_items=lore_items,
            system_prompt=req.system_prompt,
        )
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    # Optional persistence into DuckDB if a story is provided and not preview-only.
    try:
        if req.story and not req.preview_only:
            story = req.story
            # If no root exists and user has draft text, persist it as initial user snippet.
            if not snippet_store.main_path(story) and req.draft_text.strip():
                snippet_store.create_snippet(
                    story=story, content=req.draft_text, kind="user", parent_id=None
                )
            # Append the new generated continuation as a child of the current head.
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
        # Persist best-effort; do not fail the generation endpoint on storage issues.
        pass
    return ContinueResponse(**result)


@app.post("/api/suggest-context")
async def suggest_context(req: SuggestContextRequest):
    ctx = await suggest_context_from_text(
        text=req.current_text,
        model=req.model,
        max_npcs=req.max_npcs,
        max_objects=req.max_objects,
    )
    return ctx


@app.post("/api/prompt-preview", response_model=PromptPreviewResponse)
async def prompt_preview(req: PromptPreviewRequest) -> PromptPreviewResponse:
    # Build selection text: prefer draft, else history if story provided
    history_text = ""
    selection_text = (req.draft_text or "").strip()
    if (not selection_text) and req.story:
        try:
            path = snippet_store.main_path(req.story)
            history_text = snippet_store.build_text(path)
            selection_text = history_text
        except Exception:
            history_text = ""
    # Optional memory extraction from draft (to match continue flow)
    mem: MemoryState | None = None
    if req.use_memory and (req.draft_text or "").strip():
        mem = await extract_memory_from_text(text=req.draft_text, model=req.model)
    # Lore selection scoped to story
    lore_items = []
    explicit_ids = set(req.lore_ids or [])
    try:
        text_lower = selection_text.lower()[-4000:]
        lore_source = store.list(req.story) if req.story else []
        for entry in lore_source:
            if entry.id in explicit_ids:
                lore_items.append(entry)
                continue
            if getattr(entry, "always_on", False):
                lore_items.append(entry)
                continue
            keys = [k.strip().lower() for k in getattr(entry, "keys", []) if k and k.strip()]
            if keys and any(k in text_lower for k in keys):
                lore_items.append(entry)
    except Exception:
        pass
    # Build messages via PromptBuilder using the same structure as continue
    from .prompt_builder import PromptBuilder

    sys = (req.system_prompt or "").strip() or (
        "You are an expert creative writing assistant. Continue the user's story in the same voice,"  # default fallback
        " tone, and perspective. Always preserve established canon, character continuity, and"
        " world-building details. If given instructions, apply them elegantly."
    )
    if req.use_memory:
        sys += "\nUse the provided Memory to maintain continuity."
    if req.use_context:
        sys += "\nIncorporate the Context details when plausible."
    merged_instr = _merge_instruction(req.instruction, req.story)
    messages = (
        PromptBuilder()
        .with_system(sys)
        .with_instruction(merged_instr or "")
        .with_lore(lore_items)
        .with_memory(mem)
        .with_context(req.context if req.use_context else None)
        .with_history_text(history_text)
        .with_draft_text(req.draft_text or "")
        .build_messages()
    )
    return PromptPreviewResponse(messages=messages)  # type: ignore[arg-type]


@app.post("/api/stories/seed-ai", response_model=SeedStoryResponse)
async def seed_story_from_prompt(req: SeedStoryRequest) -> SeedStoryResponse:
    story = (req.story or "").strip()
    prompt = (req.prompt or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story name")
    if not prompt:
        raise HTTPException(status_code=400, detail="Missing prompt")

    # 1) Generate an opening chunk based on the prompt.
    opening_instruction = (
        "Write the opening scene for this story idea. Establish tone, POV, and a hook. "
        "Aim for 1–2 short paragraphs. Do not include meta commentary. Story idea: "
        + prompt
    )
    from .openrouter import OpenRouterClient

    client = OpenRouterClient()
    # Reuse PromptBuilder structure with empty history and only an instruction.
    from .prompt_builder import PromptBuilder

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
        content = "[Starter]"  # minimal fallback in dev mode

    # 2) Persist as root snippet for the new story.
    row = snippet_store.create_snippet(
        story=story,
        content=content,
        kind="ai",
        parent_id=None,
        set_active=None,
    )

    # 3) Derive a concise synopsis using the context suggester (summary field).
    synopsis = ""
    try:
        ctx = await suggest_context_from_text(text=content, model=req.model, max_npcs=4, max_objects=4)
        synopsis = (ctx.summary or "").strip()
        # Persist synopsis and initial context to per-story settings.
        story_settings_store.update(story, {"synopsis": synopsis, "context": ctx.model_dump()})
    except Exception:
        synopsis = ""

    # 4) Select relevant lore entries by matching keys against the prompt+content.
    relevant_ids: list[str] = []
    if req.use_lore:
        try:
            selection_text = (prompt + "\n\n" + content).lower()[-4000:]
            for entry in store.list(story):
                if getattr(entry, "always_on", False):
                    relevant_ids.append(entry.id)
                    continue
                keys = [k.strip().lower() for k in getattr(entry, "keys", []) if k and k.strip()]
                if keys and any(k in selection_text for k in keys):
                    relevant_ids.append(entry.id)
        except Exception:
            relevant_ids = []

    return SeedStoryResponse(
        story=story,
        root_snippet_id=row.id,
        content=content,
        synopsis=synopsis,
        relevant_lore_ids=relevant_ids,
    )


@app.post("/api/lorebook/generate", response_model=LoreGenerateResponse)
async def generate_lorebook(req: LoreGenerateRequest) -> LoreGenerateResponse:
    story = (req.story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story")

    # Gather current story text from main path
    path = snippet_store.main_path(story)
    story_text = snippet_store.build_text(path)
    if not story_text.strip():
        # Allow generation to proceed but likely produce minimal entries
        story_text = ""

    # JSON schema for an array of lore entries (names may be provided by user)
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

    from .openrouter import OpenRouterClient

    client = OpenRouterClient()
    names = [n.strip() for n in (req.names or []) if n and n.strip()]
    if names:
        # Guided mode: user provides names; infer and fill details for each.
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
        # Unguided mode: infer entries from story text up to max_items
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
        import json as _json

        data = content if isinstance(content, list) else _json.loads(content or "[]")
    except Exception:
        # Dev-mode fallback: create a single synopsis-style note
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

    # Apply strategy and persist
    if req.strategy == "replace":
        try:
            store.delete_all(story)
        except Exception:
            pass

    # Avoid duplicate name-kind pairs when appending
    existing = {(e.name.strip().lower(), (e.kind or "").strip().lower()) for e in store.list(story)}
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
            created_entry = store.create(
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

    total = len(store.list(story))
    return LoreGenerateResponse(story=story, created=created, total=total)

@app.post("/api/dev/seed", response_model=DevSeedResponse)
async def dev_seed(req: DevSeedRequest) -> DevSeedResponse:
    def _slug(name: str) -> str:
        return "".join(c.lower() if c.isalnum() else "_" for c in name).strip("_") or "story"

    base = Path("data/samples")
    base.mkdir(parents=True, exist_ok=True)

    # Optionally purge all data or clear only this story
    if req.purge:
        try:
            snippet_store.delete_all()
        except Exception:
            pass
        try:
            store.delete_all_global()
        except Exception:
            pass
        try:
            story_settings_store.delete_all()
        except Exception:
            pass
    elif req.clear_existing:
        try:
            snippet_store.delete_story(req.story)
        except Exception:
            pass
        try:
            store.delete_all(req.story)
        except Exception:
            pass
        try:
            story_settings_store.delete_story(req.story)
        except Exception:
            pass

    chunks_count = 0
    lore_count = 0

    # Import chunks from text file, split by blank line
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
                    kind="user",
                    parent_id=parent_id,
                    set_active=True,
                )
                parent_id = row.id
                chunks_count += 1
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to import chunks: {e}")

    # Import lorebook from JSON array if present
    lore_fname = req.lore_filename or (f"{_slug(req.story)}_lore.json")
    path_lore = base / lore_fname
    if path_lore.exists():
        import json as _json

        try:
            data = _json.loads(path_lore.read_text(encoding="utf-8"))
            if isinstance(data, list):
                for it in data:
                    try:
                        name = it.get("name", "").strip()
                        kind = it.get("kind", "").strip() or "note"
                        summary = it.get("summary", "").strip()
                        tags = it.get("tags", []) or []
                        keys = it.get("keys", []) or []
                        always_on = bool(it.get("always_on", False))
                        if not name or not summary:
                            continue
                        created = store.create(
                            LoreEntryCreate(
                                story=req.story,
                                name=name,
                                kind=kind,
                                summary=summary,
                                tags=tags,
                                keys=keys,
                                always_on=always_on,
                            )
                        )
                        if created:
                            lore_count += 1
                    except Exception:
                        continue
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to import lore: {e}")

    return DevSeedResponse(story=req.story, chunks_imported=chunks_count, lore_imported=lore_count)


# state endpoints moved to router


# story settings endpoints moved to router


# --- Snippets & Branching API ---


@app.post("/api/snippets/append", response_model=Snippet)
async def append_snippet(req: AppendSnippetRequest) -> Snippet:
    row = snippet_store.create_snippet(
        story=req.story,
        content=req.content,
        kind=req.kind,
        parent_id=req.parent_id,
        set_active=req.set_active,
    )
    # Update branch head for convenience; defaults to 'main' if not specified
    try:
        if req.set_active is not False:
            branch_name = (req.branch or "main").strip() or "main"
            snippet_store.upsert_branch(story=req.story, name=branch_name, head_id=row.id)
    except Exception:
        pass
    return Snippet(**row.__dict__)


@app.post("/api/snippets/regenerate", response_model=Snippet)
async def regenerate_snippet(req: RegenerateSnippetRequest) -> Snippet:
    row = snippet_store.regenerate_snippet(
        story=req.story,
        target_snippet_id=req.target_snippet_id,
        content=req.content,
        kind=req.kind,
        set_active=req.set_active,
    )
    try:
        if req.set_active:
            branch_name = (req.branch or "main").strip() or "main"
            snippet_store.upsert_branch(story=req.story, name=branch_name, head_id=row.id)
    except Exception:
        pass
    return Snippet(**row.__dict__)


@app.post("/api/snippets/choose-active", response_model=dict)
async def choose_active_child(req: ChooseActiveChildRequest) -> dict:
    snippet_store.choose_active_child(
        story=req.story, parent_id=req.parent_id, child_id=req.child_id
    )
    # Also update branch head to the chosen child for the given branch
    try:
        branch_name = (req.branch or "main").strip() or "main"
        snippet_store.upsert_branch(story=req.story, name=branch_name, head_id=req.child_id)
    except Exception:
        pass
    return {"ok": True}


@app.get("/api/snippets/path", response_model=BranchPathResponse)
async def get_branch_path(story: str, branch: str | None = None, head_id: str | None = None) -> BranchPathResponse:
    """Get a branch path for a story.

    - If `head_id` is provided, returns the path from root to that head.
    - Else if `branch` is provided and not 'main', looks up branch head and returns its path.
    - Else returns the main path for the story.
    """
    path = []
    if head_id:
        path = snippet_store.path_from_head(story, head_id)
    elif branch and branch.strip() and branch.strip().lower() != "main":
        # Find branch head
        branches = snippet_store.list_branches(story)
        found = None
        for b in branches:
            if b[1] == branch:
                found = b
                break
        if not found:
            raise HTTPException(status_code=404, detail="Branch not found")
        path = snippet_store.path_from_head(story, found[2])
    else:
        # Prefer branch 'main' if present; else fall back to legacy main_path
        try:
            branches = snippet_store.list_branches(story)
            main_branch = next((b for b in branches if b[1] == "main"), None)
        except Exception:
            main_branch = None
        if main_branch:
            path = snippet_store.path_from_head(story, main_branch[2])
        else:
            path = snippet_store.main_path(story)

    text = snippet_store.build_text(path)
    out_head_id = path[-1].id if path else None
    return BranchPathResponse(
        story=story,
        head_id=out_head_id,
        path=[Snippet(**p.__dict__) for p in path],
        text=text,
    )


@app.get("/api/snippets/children/{parent_id}", response_model=list[Snippet])
async def get_children(story: str, parent_id: str) -> list[Snippet]:
    items = snippet_store.list_children(story, parent_id)
    return [Snippet(**it.__dict__) for it in items]


@app.post("/api/snippets/regenerate-ai", response_model=Snippet)
async def regenerate_ai(req: RegenerateAIRequest) -> Snippet:
    # Build base draft from path up to the parent of target.
    target = snippet_store.get(req.target_snippet_id)
    if not target or target.story != req.story:
        raise HTTPException(status_code=404, detail="Target snippet not found")
    parent_id = target.parent_id
    if parent_id:
        base_path = snippet_store.path_from_head(req.story, parent_id)
    else:
        # Regenerating root: treat base text as empty
        base_path = []
    base_text = snippet_store.build_text(base_path)
    # Apply optional max context window: cap characters to 3x window from the end
    try:
        win = int(getattr(req, "max_context_window", 0) or 0)
        if win > 0 and len(base_text) > win * 3:
            base_text = base_text[-(win * 3) :]
    except Exception:
        pass

    mem: MemoryState | None = None
    if req.use_memory and base_text.strip():
        mem = await extract_memory_from_text(text=base_text, model=req.model)

    # Optional lorebook entries
    lore_items = None
    if getattr(req, "lore_ids", None):
        lore_items = []
        for _id in req.lore_ids or []:
            entry = store.get(_id)
            if entry:
                lore_items.append(entry)

    try:
        result = await continue_story(
            draft_text=base_text,
            instruction=_merge_instruction(req.instruction, req.story) or "",
            mem=mem,
            context=(req.context if req.use_context else None),
            model=req.model,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            lore_items=lore_items,
        )
    except Exception as e:
        traceback.print_exc(file=sys.stderr)
        raise HTTPException(status_code=502, detail=f"Regeneration failed: {e}")
    # Persist as an alternative child of the same parent as target
    row = snippet_store.regenerate_snippet(
        story=req.story,
        target_snippet_id=req.target_snippet_id,
        content=result.get("continuation", ""),
        kind="ai",
        set_active=req.set_active,
    )
    try:
        if req.set_active:
            branch_name = (req.branch or "main").strip() or "main"
            snippet_store.upsert_branch(story=req.story, name=branch_name, head_id=row.id)
    except Exception:
        pass
    return Snippet(**row.__dict__)


@app.put("/api/snippets/{snippet_id}", response_model=Snippet)
async def update_snippet(snippet_id: str, patch: UpdateSnippetRequest) -> Snippet:
    row = snippet_store.update_snippet(
        snippet_id=snippet_id, content=patch.content, kind=patch.kind
    )
    if not row:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return Snippet(**row.__dict__)


@app.post("/api/snippets/insert-above", response_model=Snippet)
async def insert_above(req: InsertAboveRequest) -> Snippet:
    try:
        row = snippet_store.insert_above(
            story=req.story,
            target_snippet_id=req.target_snippet_id,
            content=req.content,
            kind=req.kind,
            set_active=req.set_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Snippet(**row.__dict__)


@app.post("/api/snippets/insert-below", response_model=Snippet)
async def insert_below(req: InsertBelowRequest) -> Snippet:
    try:
        row = snippet_store.insert_below(
            story=req.story,
            parent_snippet_id=req.parent_snippet_id,
            content=req.content,
            kind=req.kind,
            set_active=req.set_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Snippet(**row.__dict__)


@app.delete("/api/snippets/{snippet_id}", response_model=DeleteSnippetResponse)
async def delete_snippet(snippet_id: str, story: str | None = None) -> DeleteSnippetResponse:
    """Delete a snippet by id.

    If `story` is provided, verify it matches the snippet's story; otherwise, infer the story
    from the snippet itself. This keeps the endpoint convenient for clients that only know the id.
    """
    row = snippet_store.get(snippet_id)
    if not row:
        raise HTTPException(status_code=404, detail="Snippet not found")
    if story is not None and story.strip() and row.story != story.strip():
        raise HTTPException(status_code=400, detail="Snippet belongs to a different story")
    try:
        ok = snippet_store.delete_snippet(story=row.story, snippet_id=snippet_id)
    except ValueError as e:
        # e.g., cannot delete a snippet that has children
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return DeleteSnippetResponse(ok=True)


@app.get("/api/snippets/tree-main", response_model=TreeResponse)
async def get_tree_for_main_path(story: str) -> TreeResponse:
    path = snippet_store.main_path(story)
    rows: list[TreeRow] = []
    for parent in path:
        children = snippet_store.list_children(story, parent.id)
        rows.append(
            TreeRow(parent=Snippet(**parent.__dict__), children=[Snippet(**c.__dict__) for c in children])
        )
    return TreeResponse(story=story, rows=rows)


@app.get("/api/snippets/{snippet_id}", response_model=Snippet)
async def get_snippet(snippet_id: str, story: str) -> Snippet:
    row = snippet_store.get(snippet_id)
    if not row or row.story != story:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return Snippet(**row.__dict__)


# Branch naming endpoints
@app.get("/api/branches", response_model=list[BranchInfo])
async def list_branches(story: str) -> list[BranchInfo]:
    rows = snippet_store.list_branches(story)
    out: list[BranchInfo] = []
    for r in rows:
        out.append(
            BranchInfo(story=r[0], name=r[1], head_id=r[2], created_at=r[3])
        )
    return out


@app.post("/api/branches", response_model=dict)
async def upsert_branch(req: UpsertBranchRequest) -> dict:
    snippet = snippet_store.get(req.head_id)
    if not snippet or snippet.story != req.story:
        raise HTTPException(status_code=404, detail="head_id not found for story")
    snippet_store.upsert_branch(story=req.story, name=req.name, head_id=req.head_id)
    return {"ok": True}


@app.delete("/api/branches/{name}", response_model=dict)
async def delete_branch(name: str, story: str) -> dict:
    snippet_store.delete_branch(story=story, name=name)
    return {"ok": True}


@app.get("/api/stories", response_model=list[str])
async def list_stories() -> list[str]:
    try:
        from_snippets = set(snippet_store.list_stories())
    except Exception:
        from_snippets = set()
    try:
        from_lore = set(store.list_stories())
    except Exception:
        from_lore = set()
    stories = sorted(from_snippets.union(from_lore))
    # Provide simple defaults if none exist
    if not stories:
        stories = ["Story One", "Story Two"]
    return stories


@app.delete("/api/stories/{story}", response_model=dict)
async def delete_story(story: str) -> dict:
    story = (story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story")
    # Best-effort delete across stores
    try:
        snippet_store.delete_story(story)
    except Exception:
        pass
    try:
        store.delete_all(story)
    except Exception:
        pass
    try:
        story_settings_store.delete_story(story)
    except Exception:
        pass
    return {"ok": True}


def _merge_instruction(user_instr: str | None, story: str | None = None) -> str | None:
    text = (user_instr or "").strip()
    if not text:
        return None
    # Prefer per-story base instruction when available
    base = None
    try:
        if story:
            data = story_settings_store.get(story)
            if data and isinstance(data, dict):
                base = (data.get("base_instruction") or "").strip() or None
    except Exception:
        base = None
    if not base:
        base = (
            "Continue the story, matching established voice, tone, and point of view. "
            "Maintain continuity with prior events and details."
        )
    return base + "\n\nFollow this direction for the continuation:\n" + text
