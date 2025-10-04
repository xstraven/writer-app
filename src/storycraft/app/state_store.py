from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from supabase import Client

from .services.supabase_client import get_supabase_client


class StateStore:
    """Supabase-backed simple key/value store for legacy global app state."""

    def __init__(self, *, client: Client | None = None, table: str = "app_state") -> None:
        self._client = client or get_supabase_client()
        self._table_name = table
        self._maybe_migrate_sqlite()

    def _table(self):
        return self._client.table(self._table_name)

    def get(self, key: str = "default") -> Dict[str, Any]:
        res = self._table().select("value").eq("key", key).limit(1).execute()
        rows = res.data or []
        if not rows:
            return {}
        raw = rows[0].get("value") or "{}"
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def set(self, data: Dict[str, Any], key: str = "default") -> None:
        payload = json.dumps(data, ensure_ascii=False)
        self._table().upsert({"key": key, "value": payload}, on_conflict="key").execute()

    def _maybe_migrate_sqlite(self) -> None:
        """If an old SQLite state.db exists locally and Supabase table is empty, import it once."""
        sqlite_path = Path("data/state.db")
        if not sqlite_path.exists():
            return
        try:
            existing = self._table().select("key").limit(1).execute()
            if existing.data:
                return
            import sqlite3

            with sqlite3.connect(sqlite_path.as_posix()) as sconn:
                cur = sconn.execute("SELECT key, value FROM app_state")
                rows = cur.fetchall()
            if not rows:
                return
            payload = [{"key": key, "value": value} for key, value in rows]
            self._table().insert(payload).execute()
        except Exception:
            pass
