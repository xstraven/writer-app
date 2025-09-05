from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Dict


class StateStore:
    """DuckDB-backed simple key/value store for legacy global app state.

    Table schema:
      - key TEXT PRIMARY KEY
      - value TEXT (JSON payload)
    """

    def __init__(self, path: str | Path = "data/story.duckdb") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()
        # Best-effort migration from old SQLite file if present
        self._maybe_migrate_sqlite()

    def _conn(self):
        import duckdb  # type: ignore

        return duckdb.connect(self.path.as_posix())

    def _init_db(self) -> None:
        with self._conn() as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS app_state (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
                """
            )

    def get(self, key: str = "default") -> Dict[str, Any]:
        with self._lock, self._conn() as con:
            cur = con.execute("SELECT value FROM app_state WHERE key = ?", [key])
            row = cur.fetchone()
            if not row:
                return {}
            try:
                return json.loads(row[0] or "{}")
            except Exception:
                return {}

    def set(self, data: Dict[str, Any], key: str = "default") -> None:
        payload = json.dumps(data, ensure_ascii=False)
        with self._lock, self._conn() as con:
            con.execute(
                "INSERT INTO app_state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [key, payload],
            )

    def _maybe_migrate_sqlite(self) -> None:
        """If an old SQLite state.db exists and DuckDB table is empty, import it once."""
        try:
            sqlite_path = Path("data/state.db")
            if not sqlite_path.exists():
                return
            # If DuckDB already has a record, skip migration
            with self._conn() as con:
                cur = con.execute("SELECT COUNT(*) FROM app_state")
                count = int(cur.fetchone()[0])
                if count > 0:
                    return
            # Read from SQLite
            import sqlite3

            with sqlite3.connect(sqlite_path.as_posix()) as sconn:
                cur = sconn.execute("SELECT key, value FROM app_state")
                rows = cur.fetchall()
            if not rows:
                return
            with self._conn() as con:
                for key, value in rows:
                    con.execute(
                        "INSERT INTO app_state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                        [key, value],
                    )
        except Exception:
            # Swallow migration errors silently
            pass
