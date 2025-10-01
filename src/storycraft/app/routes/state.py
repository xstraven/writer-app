from __future__ import annotations

from fastapi import APIRouter, Depends

from ..models import AppPersistedState
from ..dependencies import get_state_store, get_base_settings_store
from ..state_store import StateStore
from ..base_settings_store import BaseSettingsStore


router = APIRouter()


@router.get("/api/state", response_model=AppPersistedState)
async def get_state(
    state_store: StateStore = Depends(get_state_store),
    base_settings_store: BaseSettingsStore = Depends(get_base_settings_store),
) -> AppPersistedState:
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
async def put_state(
    payload: AppPersistedState,
    state_store: StateStore = Depends(get_state_store),
) -> dict:
    state_store.set(payload.model_dump())
    return {"ok": True}
