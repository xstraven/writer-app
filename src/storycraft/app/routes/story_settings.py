from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import LoreEntryCreate, StorySettings, StorySettingsPatch
from ..runtime import story_settings_store, state_store, base_settings_store, lorebook_store


router = APIRouter()


@router.get("/api/story-settings", response_model=StorySettings)
async def get_story_settings(story: str):
    story = (story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story")
    data = story_settings_store.get(story)
    if data is None:
        legacy = state_store.get()
        base_defaults = base_settings_store.get()
        merged = dict(base_defaults)
        merged.update(legacy or {})
        return StorySettings(
            story=story,
            temperature=merged.get("temperature"),
            max_tokens=merged.get("max_tokens"),
            model=merged.get("model"),
            system_prompt=merged.get("system_prompt"),
            max_context_window=merged.get("max_context_window"),
            context=merged.get("context"),
            synopsis=merged.get("synopsis"),
            memory=merged.get("memory"),
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


@router.put("/api/story-settings", response_model=dict)
async def put_story_settings(payload: StorySettingsPatch):
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
