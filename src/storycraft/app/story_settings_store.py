from __future__ import annotations

import json
from typing import Any, Dict, Optional

from supabase import Client

from .services.supabase_client import get_supabase_client


class StorySettingsStore:
    """Supabase-backed per-story settings store."""

    def __init__(self, *, client: Client | None = None, table: str = "story_settings") -> None:
        self._client = client or get_supabase_client()
        self._table_name = table

    def _table(self):
        return self._client.table(self._table_name)

    def get(self, story: str) -> Optional[Dict[str, Any]]:
        story = (story or "").strip()
        if not story:
            return None
        res = self._table().select("data").eq("story", story).limit(1).execute()
        rows = res.data or []
        if not rows:
            return None
        raw = rows[0].get("data") or "{}"
        try:
            return json.loads(raw)
        except Exception:
            return None

    def set(self, story: str, data: Dict[str, Any]) -> None:
        story = (story or "").strip()
        if not story:
            return
        payload = json.dumps(data, ensure_ascii=False)
        self._table().upsert(
            {"story": story, "data": payload},
            on_conflict="story",
        ).execute()

    def update(self, story: str, partial: Dict[str, Any]) -> Dict[str, Any]:
        current = self.get(story) or {}
        merged = {**current, **partial}
        self.set(story, merged)
        return merged

    def delete_story(self, story: str) -> None:
        self._table().delete().eq("story", story).execute()

    def delete_all(self) -> None:
        self._table().delete().execute()
