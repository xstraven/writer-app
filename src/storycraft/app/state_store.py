from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, Optional


class StateStore:
    def __init__(self, path: str | Path = "data/state.db") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path.as_posix())

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS app_state (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def get(self, key: str = "default") -> Dict[str, Any]:
        with self._lock, self._connect() as conn:
            cur = conn.execute("SELECT value FROM app_state WHERE key = ?", (key,))
            row = cur.fetchone()
            if not row:
                return {}
            try:
                return json.loads(row[0])
            except Exception:
                return {}

    def set(self, data: Dict[str, Any], key: str = "default") -> None:
        payload = json.dumps(data, ensure_ascii=False)
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO app_state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, payload),
            )
            conn.commit()

