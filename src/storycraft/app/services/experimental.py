from __future__ import annotations

from typing import Optional

from ..story_settings_store import StorySettingsStore


def internal_editor_enabled(story: Optional[str], store: StorySettingsStore) -> bool:
    story_id = (story or "").strip()
    if not story_id:
        return False
    try:
        data = store.get(story_id) or {}
    except Exception:
        return False
    experimental = data.get("experimental")
    if isinstance(experimental, dict):
        return bool(experimental.get("internal_editor_workflow"))
    if hasattr(experimental, "internal_editor_workflow"):
        try:
            return bool(getattr(experimental, "internal_editor_workflow"))
        except Exception:
            return False
    return False
