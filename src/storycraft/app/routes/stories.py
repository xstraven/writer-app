from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..models import DuplicateStoryRequest, LoreEntryCreate
from ..dependencies import (
    get_lorebook_store,
    get_snippet_store,
    get_story_settings_store,
)
from ..lorebook_store import LorebookStore
from ..snippet_store import SnippetStore
from ..story_settings_store import StorySettingsStore


router = APIRouter()


@router.get("/api/stories", response_model=list[str])
async def list_stories(
    snippet_store: SnippetStore = Depends(get_snippet_store),
    lore_store: LorebookStore = Depends(get_lorebook_store),
) -> list[str]:
    try:
        from_snippets = set(snippet_store.list_stories())
    except Exception:
        from_snippets = set()
    try:
        from_lore = set(lore_store.list_stories())
    except Exception:
        from_lore = set()
    stories = sorted(from_snippets.union(from_lore))
    if not stories:
        stories = ["Story One", "Story Two"]
    return stories


@router.delete("/api/stories/{story}", response_model=dict)
async def delete_story(
    story: str,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    lore_store: LorebookStore = Depends(get_lorebook_store),
    story_settings: StorySettingsStore = Depends(get_story_settings_store),
) -> dict:
    story = (story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story")
    try:
        snippet_store.delete_story(story)
    except Exception:
        pass
    try:
        lore_store.delete_all(story)
    except Exception:
        pass
    try:
        story_settings.delete_story(story)
    except Exception:
        pass
    return {"ok": True}


@router.post("/api/stories/duplicate", response_model=dict)
async def duplicate_story(
    req: DuplicateStoryRequest,
    snippet_store: SnippetStore = Depends(get_snippet_store),
    lore_store: LorebookStore = Depends(get_lorebook_store),
    story_settings: StorySettingsStore = Depends(get_story_settings_store),
) -> dict:
    src = (req.source or "").strip()
    dst = (req.target or "").strip()
    if not src or not dst:
        raise HTTPException(status_code=400, detail="Missing source or target")
    if src == dst:
        raise HTTPException(status_code=400, detail="Source and target must differ")

    try:
        if req.mode == "all":
            snippet_store.duplicate_story_all(source=src, target=dst)
        else:
            snippet_store.duplicate_story_main(source=src, target=dst)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to duplicate snippets: {e}")

    try:
        settings = story_settings.get(src)
        if settings:
            story_settings.set(dst, settings)
    except Exception:
        pass

    try:
        entries = lore_store.list(src)
        for entry in entries:
            try:
                lore_store.create(
                    LoreEntryCreate(
                        story=dst,
                        name=entry.name,
                        kind=entry.kind,
                        summary=entry.summary,
                        tags=entry.tags,
                        keys=entry.keys,
                        always_on=entry.always_on,
                    )
                )
            except Exception:
                continue
    except Exception:
        pass

    return {"ok": True, "story": dst}
