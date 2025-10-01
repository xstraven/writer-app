from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..models import LoreEntry, LoreEntryCreate, LoreEntryUpdate
from ..dependencies import get_lorebook_store
from ..lorebook_store import LorebookStore


router = APIRouter()


@router.get("/api/lorebook", response_model=list[LoreEntry])
async def list_lore(story: str, lorebook_store: LorebookStore = Depends(get_lorebook_store)) -> list[LoreEntry]:
    return lorebook_store.list(story)


@router.post("/api/lorebook", response_model=LoreEntry)
async def create_lore(
    payload: LoreEntryCreate,
    lorebook_store: LorebookStore = Depends(get_lorebook_store),
) -> LoreEntry:
    return lorebook_store.create(payload)


@router.put("/api/lorebook/{entry_id}", response_model=LoreEntry)
async def update_lore(
    entry_id: str,
    payload: LoreEntryUpdate,
    lorebook_store: LorebookStore = Depends(get_lorebook_store),
) -> LoreEntry:
    updated = lorebook_store.update(entry_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Lore entry not found")
    return updated


@router.delete("/api/lorebook/{entry_id}")
async def delete_lore(entry_id: str, lorebook_store: LorebookStore = Depends(get_lorebook_store)) -> dict:
    ok = lorebook_store.delete(entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Lore entry not found")
    return {"ok": True}
