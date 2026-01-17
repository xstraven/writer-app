from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
import hashlib
import os
import uuid
from pathlib import Path
import re

from ..models import ExperimentalFeatures, LoreEntryCreate, StorySettings, StorySettingsPatch
from ..dependencies import (
    get_story_settings_store,
    get_base_settings_store,
    get_lorebook_store,
)
from ..story_settings_store import StorySettingsStore
from ..base_settings_store import BaseSettingsStore
from ..lorebook_store import LorebookStore


router = APIRouter()
IMAGES_DIR = Path("./data/images")
_SAFE_DIR_RE = re.compile(r"[^a-zA-Z0-9_-]+")
_CONTENT_TYPE_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _safe_story_dir(story: str) -> str:
    story = (story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story name")
    slug = _SAFE_DIR_RE.sub("_", story).strip("_").lower()
    if not slug:
        slug = "story"
    digest = hashlib.sha256(story.encode("utf-8")).hexdigest()[:16]
    return f"{slug}-{digest}"


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
            experimental=ExperimentalFeatures(),
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
        experimental=_load_experimental(data.get("experimental")),
    )


def _load_experimental(raw: Any) -> ExperimentalFeatures | None:
    if not raw:
        return ExperimentalFeatures()
    if isinstance(raw, ExperimentalFeatures):
        return raw
    if isinstance(raw, dict):
        try:
            return ExperimentalFeatures(**raw)
        except Exception:
            pass
    return ExperimentalFeatures()


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


@router.post("/api/story-settings/upload-image")
async def upload_gallery_image(
    story: str = Form(...),
    file: UploadFile = File(...)
) -> dict:
    """Upload an image file for a story's gallery"""
    story = (story or "").strip()
    if not story:
        raise HTTPException(status_code=400, detail="Missing story name")

    # Validate file type
    ext = _CONTENT_TYPE_EXT.get(file.content_type or "")
    if not ext:
        raise HTTPException(status_code=400, detail=f"Invalid file type")

    # Validate file size (10MB max)
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Create story directory
    story_dir = IMAGES_DIR / _safe_story_dir(story)
    story_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = story_dir / unique_filename
    base_dir = IMAGES_DIR.resolve()
    if base_dir not in file_path.resolve().parents:
        raise HTTPException(status_code=400, detail="Invalid upload path")

    # Save file
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return {
        "ok": True,
        "filename": unique_filename,
        "original_filename": file.filename,
        "story": story,
        "url": f"/api/images/{story_dir.name}/{unique_filename}"
    }


@router.delete("/api/story-settings/delete-image")
async def delete_gallery_image(story: str, filename: str) -> dict:
    """Delete an uploaded image file"""
    story = (story or "").strip()
    if not story or not filename:
        raise HTTPException(status_code=400, detail="Missing story or filename")

    # Prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename or Path(filename).name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_path = IMAGES_DIR / _safe_story_dir(story) / filename
    base_dir = IMAGES_DIR.resolve()
    if base_dir not in file_path.resolve().parents:
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_path.unlink()
    return {"ok": True, "deleted": filename}
