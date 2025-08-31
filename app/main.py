from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .lorebook_store import LorebookStore
from .memory import continue_story, extract_memory_from_text
from .models import (
    ContinueRequest,
    ContinueResponse,
    ExtractMemoryRequest,
    HealthResponse,
    LoreEntry,
    LoreEntryCreate,
    LoreEntryUpdate,
    MemoryState,
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

store = LorebookStore()


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.get("/api/lorebook", response_model=list[LoreEntry])
async def list_lore() -> list[LoreEntry]:
    return store.list()


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

    result = await continue_story(
        draft_text=req.draft_text,
        instruction=req.instruction,
        mem=mem,
        model=req.model,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
    )
    return ContinueResponse(**result)

