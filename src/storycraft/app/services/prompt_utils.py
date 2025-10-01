from __future__ import annotations

from typing import Iterable, Optional

from ..lorebook_store import LorebookStore
from ..models import LoreEntry
from ..story_settings_store import StorySettingsStore


def merge_instruction(
    user_instruction: Optional[str],
    story: Optional[str],
    story_settings: StorySettingsStore,
) -> Optional[str]:
    text = (user_instruction or "").strip()
    if not text:
        return None

    base = None
    if story:
        try:
            data = story_settings.get(story)
        except Exception:
            data = None
        if isinstance(data, dict):
            base_candidate = (data.get("base_instruction") or "").strip()
            if base_candidate:
                base = base_candidate

    if not base:
        base = (
            "Continue the story, matching established voice, tone, and point of view. "
            "Maintain continuity with prior events and details."
        )

    return base + "\n\nFollow this direction for the continuation:\n" + text


def select_lore_items(
    lore_store: LorebookStore,
    *,
    story: Optional[str],
    explicit_ids: Iterable[str] | None,
    selection_text: str,
) -> list[LoreEntry]:
    explicit = {eid for eid in (explicit_ids or []) if eid}
    picked: list[LoreEntry] = []
    try:
        text_lower = (selection_text or "").lower()[-4000:]
        lore_source = lore_store.list(story) if story else []
        for entry in lore_source:
            if entry.id in explicit:
                picked.append(entry)
                continue
            if getattr(entry, "always_on", False):
                picked.append(entry)
                continue
            keys = [k.strip().lower() for k in getattr(entry, "keys", []) if k and k.strip()]
            if keys and any(k in text_lower for k in keys):
                picked.append(entry)
    except Exception:
        if not picked and explicit:
            for eid in explicit:
                try:
                    entry = lore_store.get(eid)
                except Exception:
                    entry = None
                if entry:
                    picked.append(entry)
    else:
        if explicit:
            # Ensure explicit ids are included even if not present in selection above
            present_ids = {e.id for e in picked}
            for eid in explicit:
                if eid in present_ids:
                    continue
                try:
                    entry = lore_store.get(eid)
                except Exception:
                    entry = None
                if entry:
                    picked.append(entry)
    return picked
