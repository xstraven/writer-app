from __future__ import annotations

import json
import threading
import uuid
from pathlib import Path
from typing import List, Optional

from .models import LoreEntry, LoreEntryCreate, LoreEntryUpdate


class LorebookStore:
    """DuckDB-backed lorebook store. Imports existing JSON on first use if present.

    Table schema:
      - id TEXT PRIMARY KEY
      - story TEXT NOT NULL
      - name TEXT NOT NULL
      - kind TEXT NOT NULL
      - summary TEXT NOT NULL
      - tags TEXT (JSON)
      - keys TEXT (JSON)
      - always_on BOOLEAN
    """

    def __init__(self, db_path: str | Path = "data/story.duckdb", legacy_json: str | Path = "data/lorebook.json", **kwargs) -> None:
        # Back-compat: accept 'path' keyword to specify a legacy JSON file, and pick a sibling DB
        legacy_path = kwargs.pop("path", None)
        if legacy_path is not None:
            legacy_json = legacy_path
            p = Path(legacy_path)
            # Use a DB next to the provided JSON path
            db_path = p.with_suffix(".duckdb")
        self.db_path = Path(db_path)
        self.legacy_json = Path(legacy_json)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()
        self._maybe_import_legacy_json()

    def _conn(self):
        import duckdb  # type: ignore

        return duckdb.connect(self.db_path.as_posix())

    def _init_db(self) -> None:
        with self._conn() as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS lorebook (
                    id TEXT PRIMARY KEY,
                    story TEXT NOT NULL,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    tags TEXT,
                    keys TEXT,
                    always_on BOOLEAN
                )
                """
            )
            con.execute("CREATE INDEX IF NOT EXISTS idx_lore_story ON lorebook(story)")

    def _maybe_import_legacy_json(self) -> None:
        try:
            if not self.legacy_json.exists():
                return
            # If DB already has entries, skip import
            with self._conn() as con:
                cnt = int(con.execute("SELECT COUNT(*) FROM lorebook").fetchone()[0])
                if cnt > 0:
                    return
            # Read old JSON file and import
            raw = json.loads(self.legacy_json.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                return
            with self._conn() as con:
                for _id, v in raw.items():
                    try:
                        e = LoreEntry(**v)
                        con.execute(
                            "INSERT INTO lorebook(id, story, name, kind, summary, tags, keys, always_on) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
                            [
                                e.id,
                                e.story,
                                e.name,
                                e.kind,
                                e.summary,
                                json.dumps(e.tags),
                                json.dumps(e.keys),
                                bool(e.always_on),
                            ],
                        )
                    except Exception:
                        continue
        except Exception:
            # Swallow import errors
            pass

    def list(self, story: Optional[str] = None) -> List[LoreEntry]:
        with self._lock, self._conn() as con:
            if story is None:
                rows = con.execute("SELECT * FROM lorebook").fetchall()
            else:
                rows = con.execute("SELECT * FROM lorebook WHERE story = ? ORDER BY name ASC", [story]).fetchall()
        return [
            LoreEntry(
                id=r[0], story=r[1], name=r[2], kind=r[3], summary=r[4], tags=json.loads(r[5] or "[]"), keys=json.loads(r[6] or "[]"), always_on=bool(r[7])
            )
            for r in rows
        ]

    def list_stories(self) -> list[str]:
        with self._lock, self._conn() as con:
            rows = con.execute("SELECT DISTINCT story FROM lorebook ORDER BY story").fetchall()
        return [r[0] for r in rows]

    def get(self, entry_id: str) -> Optional[LoreEntry]:
        with self._lock, self._conn() as con:
            r = con.execute("SELECT * FROM lorebook WHERE id = ?", [entry_id]).fetchone()
        if not r:
            return None
        return LoreEntry(
            id=r[0], story=r[1], name=r[2], kind=r[3], summary=r[4], tags=json.loads(r[5] or "[]"), keys=json.loads(r[6] or "[]"), always_on=bool(r[7])
        )

    def create(self, payload: LoreEntryCreate) -> LoreEntry:
        entry_id = uuid.uuid4().hex
        entry = LoreEntry(id=entry_id, **payload.model_dump())
        with self._lock, self._conn() as con:
            con.execute(
                "INSERT INTO lorebook(id, story, name, kind, summary, tags, keys, always_on) VALUES(?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    entry.id,
                    entry.story,
                    entry.name,
                    entry.kind,
                    entry.summary,
                    json.dumps(entry.tags),
                    json.dumps(entry.keys),
                    bool(entry.always_on),
                ],
            )
        return entry

    def update(self, entry_id: str, patch: LoreEntryUpdate) -> Optional[LoreEntry]:
        current = self.get(entry_id)
        if not current:
            return None
        data = current.model_dump()
        update = patch.model_dump(exclude_unset=True)
        data.update({k: v for k, v in update.items() if v is not None})
        updated = LoreEntry(**data)
        with self._lock, self._conn() as con:
            con.execute(
                "UPDATE lorebook SET story = ?, name = ?, kind = ?, summary = ?, tags = ?, keys = ?, always_on = ? WHERE id = ?",
                [
                    updated.story,
                    updated.name,
                    updated.kind,
                    updated.summary,
                    json.dumps(updated.tags),
                    json.dumps(updated.keys),
                    bool(updated.always_on),
                    entry_id,
                ],
            )
        return updated

    def delete(self, entry_id: str) -> bool:
        with self._lock, self._conn() as con:
            con.execute("DELETE FROM lorebook WHERE id = ?", [entry_id])
            return True

    def delete_all(self, story: str) -> None:
        with self._lock, self._conn() as con:
            con.execute("DELETE FROM lorebook WHERE story = ?", [story])

    def delete_all_global(self) -> None:
        with self._lock, self._conn() as con:
            con.execute("DELETE FROM lorebook")
