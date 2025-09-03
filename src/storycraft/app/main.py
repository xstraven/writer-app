from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .lorebook_store import LorebookStore
from .memory import continue_story, extract_memory_from_text, suggest_context_from_text
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
)
from .state_store import StateStore
from .snippet_store import SnippetStore


settings = get_settings()
app = FastAPI(title="Storycraft API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = LorebookStore()
state_store = StateStore()
snippet_store = SnippetStore()


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.get("/api/lorebook", response_model=list[LoreEntry])
async def list_lore(story: str) -> list[LoreEntry]:
    return store.list(story)


@app.post("/api/lorebook", response_model=LoreEntry)
async def create_lore(payload: LoreEntryCreate) -> LoreEntry:
    return store.create(payload)


@app.put("/api/lorebook/{entry_id}", response_model=LoreEntry)
async def update_lore(entry_id: str, payload: LoreEntryUpdate) -> LoreEntry:
    updated = store.update(entry_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Lore entry not found")
    return updated


@app.delete("/api/lorebook/{entry_id}")
async def delete_lore(entry_id: str) -> dict:
    ok = store.delete(entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Lore entry not found")
    return {"ok": True}


@app.post("/api/extract-memory", response_model=MemoryState)
async def extract_memory(req: ExtractMemoryRequest) -> MemoryState:
    return await extract_memory_from_text(text=req.current_text, model=req.model, max_items=req.max_items)


@app.post("/api/continue", response_model=ContinueResponse)
async def continue_endpoint(req: ContinueRequest) -> ContinueResponse:
    mem: MemoryState | None = None
    if req.use_memory and req.draft_text.strip():
        mem = await extract_memory_from_text(text=req.draft_text, model=req.model)
    # Select lorebook entries: union of explicit IDs + auto by keys + always_on.
    lore_items = []
    explicit_ids = set(req.lore_ids or [])
    # Build selection text from draft or history (prefer draft).
    selection_text = (req.draft_text or "").strip() or ""
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

    result = await continue_story(
        draft_text=req.draft_text,
        instruction=req.instruction,
        mem=mem,
        context=(req.context if req.use_context else None),
        model=req.model,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
        history_text=history_text,
        lore_items=lore_items,
        system_prompt=req.system_prompt,
    )
    # Optional persistence into DuckDB if a story is provided.
    try:
        if req.story:
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


@app.get("/api/state", response_model=AppPersistedState)
async def get_state() -> AppPersistedState:
    data = state_store.get()
    try:
        return AppPersistedState(**data)
    except Exception:
        return AppPersistedState()


@app.put("/api/state", response_model=dict)
async def put_state(payload: AppPersistedState) -> dict:
    state_store.set(payload.model_dump())
    return {"ok": True}


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
    return Snippet(**row.__dict__)


@app.post("/api/snippets/choose-active", response_model=dict)
async def choose_active_child(req: ChooseActiveChildRequest) -> dict:
    snippet_store.choose_active_child(
        story=req.story, parent_id=req.parent_id, child_id=req.child_id
    )
    return {"ok": True}


@app.get("/api/snippets/path", response_model=BranchPathResponse)
async def get_main_path(story: str) -> BranchPathResponse:
    path = snippet_store.main_path(story)
    text = snippet_store.build_text(path)
    head_id = path[-1].id if path else None
    return BranchPathResponse(
        story=story,
        head_id=head_id,
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

    result = await continue_story(
        draft_text=base_text,
        instruction=req.instruction,
        mem=mem,
        context=(req.context if req.use_context else None),
        model=req.model,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
        lore_items=lore_items,
    )
    # Persist as an alternative child of the same parent as target
    row = snippet_store.regenerate_snippet(
        story=req.story,
        target_snippet_id=req.target_snippet_id,
        content=result.get("continuation", ""),
        kind="ai",
        set_active=req.set_active,
    )
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
async def delete_snippet(snippet_id: str, story: str) -> DeleteSnippetResponse:
    try:
        ok = snippet_store.delete_snippet(story=story, snippet_id=snippet_id)
    except ValueError as e:
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
