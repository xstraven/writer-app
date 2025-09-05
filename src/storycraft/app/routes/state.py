from __future__ import annotations

from fastapi import APIRouter

from ..models import AppPersistedState
from ..runtime import state_store, base_settings_store


router = APIRouter()


@router.get("/api/state", response_model=AppPersistedState)
async def get_state() -> AppPersistedState:
    data = state_store.get()
    try:
        base_defaults = base_settings_store.get()
        merged = dict(base_defaults)
        merged.update(data or {})
        return AppPersistedState(**merged)
    except Exception:
        try:
            return AppPersistedState(**base_settings_store.get())
        except Exception:
            return AppPersistedState()


@router.put("/api/state", response_model=dict)
async def put_state(payload: AppPersistedState) -> dict:
    state_store.set(payload.model_dump())
    return {"ok": True}

