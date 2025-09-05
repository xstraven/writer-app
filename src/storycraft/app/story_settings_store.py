from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Dict, Optional


class StorySettingsStore:
    """DuckDB-backed per-story settings store.

    Schema:
      - story TEXT PRIMARY KEY
      - data  TEXT (JSON payload)
    """

    def __init__(self, path: str | Path = "data/story.duckdb") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _conn(self):
        import duckdb  # type: ignore

        return duckdb.connect(self.path.as_posix())

    def _init_db(self) -> None:
        with self._conn() as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS story_settings (
                    story TEXT PRIMARY KEY,
                    data TEXT
                )
                """
            )

    def get(self, story: str) -> Optional[Dict[str, Any]]:
        story = (story or "").strip()
        if not story:
            return None
        with self._lock, self._conn() as con:
            cur = con.execute("SELECT data FROM story_settings WHERE story = ?", [story])
            row = cur.fetchone()
            if not row:
                return None
            try:
                return json.loads(row[0] or "{}")
            except Exception:
                return None

    def set(self, story: str, data: Dict[str, Any]) -> None:
        story = (story or "").strip()
        if not story:
            return
        payload = json.dumps(data, ensure_ascii=False)
        with self._lock, self._conn() as con:
            con.execute(
                "INSERT INTO story_settings(story, data) VALUES(?, ?) ON CONFLICT(story) DO UPDATE SET data = excluded.data",
                [story, payload],
            )

    def update(self, story: str, partial: Dict[str, Any]) -> Dict[str, Any]:
        current = self.get(story) or {}
        # Shallow merge only for known keys; nested context can be replaced entirely by client
        merged = {**current, **partial}
        self.set(story, merged)
        return merged

    def delete_story(self, story: str) -> None:
        with self._lock, self._conn() as con:
            con.execute("DELETE FROM story_settings WHERE story = ?", [story])

    def delete_all(self) -> None:
        with self._lock, self._conn() as con:
            con.execute("DELETE FROM story_settings")

