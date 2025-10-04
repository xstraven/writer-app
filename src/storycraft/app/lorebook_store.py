from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import List, Optional

from supabase import Client

from .models import LoreEntry, LoreEntryCreate, LoreEntryUpdate
from .services.supabase_client import get_supabase_client


class LorebookStore:
    """Supabase-backed lorebook store. Imports existing JSON on first use if present."""

    def __init__(
        self,
        *,
        client: Client | None = None,
        table: str = "lorebook",
        legacy_json: str | Path = "data/lorebook.json",
    ) -> None:
        self._client = client or get_supabase_client()
        self._table_name = table
        self.legacy_json = Path(legacy_json)
        self._maybe_import_legacy_json()

    def _table(self):
        return self._client.table(self._table_name)

    def _maybe_import_legacy_json(self) -> None:
        if not self.legacy_json.exists():
            return
        try:
            existing = self._table().select("id").limit(1).execute()
            if existing.data:
                return
            raw = json.loads(self.legacy_json.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                return
            payload = []
            for value in raw.values():
                try:
                    entry = LoreEntry(**value)
                except Exception:
                    continue
                payload.append(
                    {
                        "id": entry.id,
                        "story": entry.story,
                        "name": entry.name,
                        "kind": entry.kind,
                        "summary": entry.summary,
                        "tags": json.dumps(entry.tags),
                        "keys": json.dumps(entry.keys),
                        "always_on": bool(entry.always_on),
                    }
                )
            if payload:
                self._table().insert(payload).execute()
        except Exception:
            pass

    def list(self, story: Optional[str] = None) -> List[LoreEntry]:
        query = self._table().select("*")
        if story is not None:
            query = query.eq("story", story).order("name", desc=False)
        res = query.execute()
        rows = res.data or []
        return [
            LoreEntry(
                id=r["id"],
                story=r["story"],
                name=r["name"],
                kind=r["kind"],
                summary=r["summary"],
                tags=json.loads(r.get("tags") or "[]"),
                keys=json.loads(r.get("keys") or "[]"),
                always_on=bool(r.get("always_on")),
            )
            for r in rows
        ]

    def list_stories(self) -> list[str]:
        res = self._table().select("story").execute()
        return sorted({r["story"] for r in res.data or [] if r.get("story")})

    def get(self, entry_id: str) -> Optional[LoreEntry]:
        res = self._table().select("*").eq("id", entry_id).limit(1).execute()
        rows = res.data or []
        if not rows:
            return None
        r = rows[0]
        return LoreEntry(
            id=r["id"],
            story=r["story"],
            name=r["name"],
            kind=r["kind"],
            summary=r["summary"],
            tags=json.loads(r.get("tags") or "[]"),
            keys=json.loads(r.get("keys") or "[]"),
            always_on=bool(r.get("always_on")),
        )

    def create(self, payload: LoreEntryCreate) -> LoreEntry:
        entry_id = uuid.uuid4().hex
        data = LoreEntry(id=entry_id, **payload.model_dump())
        self._table().insert(
            {
                "id": data.id,
                "story": data.story,
                "name": data.name,
                "kind": data.kind,
                "summary": data.summary,
                "tags": json.dumps(data.tags),
                "keys": json.dumps(data.keys),
                "always_on": bool(data.always_on),
            }
        ).execute()
        return data

    def update(self, entry_id: str, patch: LoreEntryUpdate) -> Optional[LoreEntry]:
        current = self.get(entry_id)
        if not current:
            return None
        data = current.model_dump()
        data.update({k: v for k, v in patch.model_dump(exclude_unset=True).items() if v is not None})
        updated = LoreEntry(**data)
        self._table().update(
            {
                "story": updated.story,
                "name": updated.name,
                "kind": updated.kind,
                "summary": updated.summary,
                "tags": json.dumps(updated.tags),
                "keys": json.dumps(updated.keys),
                "always_on": bool(updated.always_on),
            }
        ).eq("id", entry_id).execute()
        return updated

    def delete(self, entry_id: str) -> bool:
        self._table().delete().eq("id", entry_id).execute()
        return True

    def delete_all(self, story: str) -> None:
        self._table().delete().eq("story", story).execute()

    def delete_all_global(self) -> None:
        self._table().delete().execute()
