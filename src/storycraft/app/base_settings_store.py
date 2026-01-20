from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Dict


DEFAULTS: Dict[str, Any] = {
    "model": "deepseek/deepseek-chat-v3-0324",
    "temperature": 1.0,
    "max_tokens": 1024,
    "max_context_window": 15000,
    "include_memory": True,
    "include_context": True,
    "system_prompt": (
        "You are an expert creative writing assistant. Continue the user's story in the same voice,"
        " tone, and perspective. Always preserve established canon, character continuity, and"
        " world-building details. If given instructions, apply them elegantly."
    ),
}


class BaseSettingsStore:
    """File-backed defaults for generation settings and system prompt.

    Users can edit data/base_settings.json to set global defaults. The app's
    persisted UI state remains separate; when no state is set, we fall back
    to these defaults.
    """

    def __init__(self, path: str | Path = "data/base_settings.json") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        # Initialize file if missing
        if not self.path.exists():
            self._write(DEFAULTS)

    def _read(self) -> Dict[str, Any]:
        with self._lock:
            try:
                with self.path.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    return data
            except Exception:
                pass
            return dict(DEFAULTS)

    def _write(self, data: Dict[str, Any]) -> None:
        tmp = self.path.with_suffix(".tmp")
        with self._lock:
            with tmp.open("w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            os.replace(tmp, self.path)

    def get(self) -> Dict[str, Any]:
        # Merge with defaults to ensure all keys are present
        data = dict(DEFAULTS)
        try:
            data.update(self._read())
        except Exception:
            pass
        return data

    def set(self, data: Dict[str, Any]) -> None:
        merged = dict(DEFAULTS)
        merged.update(data)
        self._write(merged)
