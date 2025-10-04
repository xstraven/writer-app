from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..models import LoreEntryCreate, StorySettings, StorySettingsPatch
from ..dependencies import (
    get_story_settings_store,
    get_base_settings_store,
    get_lorebook_store,
)
from ..story_settings_store import StorySettingsStore
from ..base_settings_store import BaseSettingsStore
from ..lorebook_store import LorebookStore


router = APIRouter()


@router.get("/api/story-settings", response_model=StorySettings)
async def get_story_settings(
    story: str,
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
    base_settings_store: BaseSettingsStore = Depends(get_base_settings_store),
) -> StorySettings:
    story = (story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story")
    data = story_settings_store.get(story)
    if data is None:
        # For a new story with no saved settings, return generation defaults only.
        # Do NOT copy legacy global state (context/synopsis/memory) to avoid leaking
        # prior story data into new stories.
        base_defaults = base_settings_store.get()
        return StorySettings(
            story=story,
            temperature=base_defaults.get("temperature"),
            max_tokens=base_defaults.get("max_tokens"),
            model=base_defaults.get("model"),
            system_prompt=base_defaults.get("system_prompt"),
            max_context_window=base_defaults.get("max_context_window"),
            context=None,
            synopsis=None,
            memory=None,
            gallery=[],
        )
    return StorySettings(
        story=story,
        temperature=data.get("temperature"),
        max_tokens=data.get("max_tokens"),
        model=data.get("model"),
        system_prompt=data.get("system_prompt"),
        base_instruction=data.get("base_instruction"),
        max_context_window=data.get("max_context_window"),
        context=data.get("context"),
        synopsis=data.get("synopsis"),
        memory=data.get("memory"),
        gallery=data.get("gallery") or [],
    )


async def _write_story_settings(
    payload: StorySettingsPatch,
    story_settings_store: StorySettingsStore,
    lorebook_store: LorebookStore,
) -> dict:
    story = (payload.story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story")
    allowed = payload.model_dump(exclude_unset=True)
    allowed.pop("story", None)
    # Extract lorebook if present in payload
    lore = allowed.pop("lorebook", None)
    story_settings_store.update(story, allowed)
    if lore is not None and isinstance(lore, list):
        # Replace lorebook for this story
        try:
            lorebook_store.delete_all(story)
            for item in lore:
                try:
                    lec = LoreEntryCreate(
                        story=story,
                        name=item.get("name", ""),
                        kind=item.get("kind", "note") or "note",
                        summary=item.get("summary", ""),
                        tags=item.get("tags", []) or [],
                        keys=item.get("keys", []) or [],
                        always_on=bool(item.get("always_on", False)),
                    )
                    if lec.name and lec.summary:
                        lorebook_store.create(lec)
                except Exception:
                    continue
        except Exception:
            # Ignore lore replacement errors to not block settings update
            pass
    return {"ok": True, "story": story, "updated_keys": list(allowed.keys())}


@router.put("/api/story-settings", response_model=dict)
async def put_story_settings(
    payload: StorySettingsPatch,
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
    lorebook_store: LorebookStore = Depends(get_lorebook_store),
) -> dict:
    return await _write_story_settings(payload, story_settings_store, lorebook_store)


@router.post("/api/story-settings", response_model=dict)
async def post_story_settings(
    payload: StorySettingsPatch,
    story_settings_store: StorySettingsStore = Depends(get_story_settings_store),
    lorebook_store: LorebookStore = Depends(get_lorebook_store),
) -> dict:
    return await _write_story_settings(payload, story_settings_store, lorebook_store)
