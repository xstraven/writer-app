from __future__ import annotations

import json
import os
import threading
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from .models import LoreEntry, LoreEntryCreate, LoreEntryUpdate


class LorebookStore:
    def __init__(self, path: str | Path = "data/lorebook.json") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        if not self.path.exists():
            self._write({})

    def _read(self) -> Dict[str, LoreEntry]:
        with self._lock:
            with self.path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
        return {k: LoreEntry(**v) for k, v in raw.items()}

    def _write(self, data: Dict[str, dict]) -> None:
        with self._lock:
            tmp = self.path.with_suffix(".tmp")
            with tmp.open("w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            os.replace(tmp, self.path)

    def list(self) -> List[LoreEntry]:
        return list(self._read().values())

    def get(self, entry_id: str) -> Optional[LoreEntry]:
        return self._read().get(entry_id)

    def create(self, payload: LoreEntryCreate) -> LoreEntry:
        data = self._read()
        entry_id = uuid.uuid4().hex
        entry = LoreEntry(id=entry_id, **payload.model_dump())
        data[entry_id] = entry.model_dump()
        self._write(data)
        return entry

    def update(self, entry_id: str, patch: LoreEntryUpdate) -> Optional[LoreEntry]:
        data = self._read()
        if entry_id not in data:
            return None
        current = LoreEntry(**data[entry_id])
        update = patch.model_dump(exclude_unset=True)
        for k, v in update.items():
            setattr(current, k, v)
        data[entry_id] = current.model_dump()
        self._write(data)
        return current

    def delete(self, entry_id: str) -> bool:
        data = self._read()
        if entry_id in data:
            del data[entry_id]
            self._write(data)
            return True
        return False

