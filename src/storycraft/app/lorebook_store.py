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

    def _read_raw(self) -> Dict[str, dict]:
        """Read the on-disk JSON as a plain dict map."""
        with self._lock:
            with self.path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
        # Ensure structure is dict[str, dict]
        out: Dict[str, dict] = {}
        for k, v in raw.items():
            if isinstance(v, dict):
                out[k] = v
            else:
                # Back-compat: if older code wrote pydantic-like objects, coerce via model
                try:
                    out[k] = LoreEntry(**v).model_dump()  # type: ignore[arg-type]
                except Exception:
                    out[k] = json.loads(json.dumps(v, default=str))
        return out

    def _read(self) -> Dict[str, LoreEntry]:
        raw = self._read_raw()
        fixed: Dict[str, LoreEntry] = {}
        for k, v in raw.items():
            if "story" not in v or not v.get("story"):
                # Backward-compat: assign old entries to default story
                v = {**v, "story": "Story One"}
            fixed[k] = LoreEntry(**v)
        return fixed

    def _write(self, data: Dict[str, dict]) -> None:
        with self._lock:
            tmp = self.path.with_suffix(".tmp")
            with tmp.open("w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            os.replace(tmp, self.path)

    def list(self, story: Optional[str] = None) -> List[LoreEntry]:
        items = list(self._read().values())
        if story is None:
            return items
        return [e for e in items if getattr(e, "story", None) == story]

    def get(self, entry_id: str) -> Optional[LoreEntry]:
        return self._read().get(entry_id)

    def create(self, payload: LoreEntryCreate) -> LoreEntry:
        data = self._read_raw()
        entry_id = uuid.uuid4().hex
        entry = LoreEntry(id=entry_id, **payload.model_dump())
        data[entry_id] = entry.model_dump()
        self._write(data)
        return entry

    def update(self, entry_id: str, patch: LoreEntryUpdate) -> Optional[LoreEntry]:
        data = self._read_raw()
        if entry_id not in data:
            return None
        current = data[entry_id]
        update = patch.model_dump(exclude_unset=True)
        # Apply partial update into the plain dict, preserving id
        for k, v in update.items():
            current[k] = v
        # Validate via model, then write back the normalized dict
        model = LoreEntry(**current)
        data[entry_id] = model.model_dump()
        self._write(data)
        return model

    def delete(self, entry_id: str) -> bool:
        data = self._read_raw()
        if entry_id in data:
            del data[entry_id]
            self._write(data)
            return True
        return False
