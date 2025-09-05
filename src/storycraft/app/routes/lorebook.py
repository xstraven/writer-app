from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import LoreEntry, LoreEntryCreate, LoreEntryUpdate
from ..runtime import lorebook_store


router = APIRouter()


@router.get("/api/lorebook", response_model=list[LoreEntry])
async def list_lore(story: str) -> list[LoreEntry]:
    return lorebook_store.list(story)


@router.post("/api/lorebook", response_model=LoreEntry)
async def create_lore(payload: LoreEntryCreate) -> LoreEntry:
    return lorebook_store.create(payload)


@router.put("/api/lorebook/{entry_id}", response_model=LoreEntry)
async def update_lore(entry_id: str, payload: LoreEntryUpdate) -> LoreEntry:
    updated = lorebook_store.update(entry_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Lore entry not found")
    return updated


@router.delete("/api/lorebook/{entry_id}")
async def delete_lore(entry_id: str) -> dict:
    ok = lorebook_store.delete(entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Lore entry not found")
    return {"ok": True}

