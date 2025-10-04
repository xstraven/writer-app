from __future__ import annotations

import threading
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from supabase import Client, create_client

from ..config import get_settings


@dataclass
class _InMemoryResult:
    data: List[Dict[str, Any]]


class _InMemoryQuery:
    def __init__(
        self,
        store: List[Dict[str, Any]],
        *,
        action: str,
        payload: Any = None,
        on_conflict: Optional[str] = None,
    ) -> None:
        self._store = store
        self._action = action
        self._payload = payload
        self._filters: List[tuple[str, Any]] = []
        self._order: Optional[tuple[str, bool]] = None
        self._limit: Optional[int] = None
        self._on_conflict = on_conflict

    def select(self, *_: Any) -> _InMemoryQuery:
        self._action = "select"
        return self

    def eq(self, column: str, value: Any) -> _InMemoryQuery:
        self._filters.append((column, value))
        return self

    def order(self, column: str, *, desc: bool = False) -> _InMemoryQuery:
        self._order = (column, desc)
        return self

    def limit(self, value: int) -> _InMemoryQuery:
        self._limit = value
        return self

    def insert(self, payload: Any) -> _InMemoryQuery:
        return _InMemoryQuery(self._store, action="insert", payload=payload)

    def update(self, payload: Dict[str, Any]) -> _InMemoryQuery:
        query = _InMemoryQuery(self._store, action="update", payload=payload)
        query._filters = list(self._filters)
        return query

    def delete(self) -> _InMemoryQuery:
        query = _InMemoryQuery(self._store, action="delete")
        query._filters = list(self._filters)
        return query

    def upsert(self, payload: Any, *, on_conflict: Optional[str] = None) -> _InMemoryQuery:
        return _InMemoryQuery(
            self._store,
            action="upsert",
            payload=payload,
            on_conflict=on_conflict,
        )

    def _apply_filters(self, rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [row for row in rows if all(row.get(col) == value for col, value in self._filters)]

    @staticmethod
    def _ensure_created_at(row: Dict[str, Any]) -> None:
        if "created_at" not in row:
            row["created_at"] = datetime.now(tz=timezone.utc).isoformat()

    def execute(self) -> _InMemoryResult:
        if self._action == "select":
            rows = self._apply_filters(self._store)
            if self._order:
                key, desc = self._order
                rows = sorted(rows, key=lambda item: item.get(key), reverse=desc)
            if self._limit is not None:
                rows = rows[: self._limit]
            return _InMemoryResult([deepcopy(row) for row in rows])

        if self._action == "insert":
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            out = []
            for row in rows:
                record = deepcopy(row)
                self._ensure_created_at(record)
                self._store.append(record)
                out.append(deepcopy(record))
            return _InMemoryResult(out)

        if self._action == "update":
            rows = self._apply_filters(self._store)
            for row in rows:
                row.update(self._payload)
            return _InMemoryResult([deepcopy(r) for r in rows])

        if self._action == "delete":
            matches = self._apply_filters(self._store)
            self._store[:] = [row for row in self._store if row not in matches]
            return _InMemoryResult([deepcopy(r) for r in matches])

        if self._action == "upsert":
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            out: List[Dict[str, Any]] = []
            keys = []
            if self._on_conflict:
                keys = [key.strip() for key in self._on_conflict.split(",") if key.strip()]
            for row in rows:
                record = deepcopy(row)
                self._ensure_created_at(record)
                match = None
                if keys:
                    for existing in self._store:
                        if all(existing.get(k) == record.get(k) for k in keys):
                            match = existing
                            break
                if match:
                    match.update(record)
                    out.append(deepcopy(match))
                else:
                    self._store.append(record)
                    out.append(deepcopy(record))
            return _InMemoryResult(out)

        raise RuntimeError(f"Unsupported in-memory action: {self._action}")


class _InMemoryTable:
    def __init__(self, store: List[Dict[str, Any]]) -> None:
        self._store = store

    def select(self, *_: Any) -> _InMemoryQuery:
        return _InMemoryQuery(self._store, action="select")

    def insert(self, payload: Any) -> _InMemoryQuery:
        return _InMemoryQuery(self._store, action="insert", payload=payload)

    def update(self, payload: Dict[str, Any]) -> _InMemoryQuery:
        return _InMemoryQuery(self._store, action="update", payload=payload)

    def delete(self) -> _InMemoryQuery:
        return _InMemoryQuery(self._store, action="delete")

    def upsert(self, payload: Any, *, on_conflict: Optional[str] = None) -> _InMemoryQuery:
        return _InMemoryQuery(self._store, action="upsert", payload=payload, on_conflict=on_conflict)


class InMemorySupabaseClient:
    def __init__(self) -> None:
        self._tables: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def table(self, name: str) -> _InMemoryTable:
        return _InMemoryTable(self._tables[name])


_client_lock = threading.Lock()
_client: Optional[Client] = None


def get_supabase_client(url: Optional[str] = None, key: Optional[str] = None) -> Client:  # type: ignore[override]
    global _client
    with _client_lock:
        if _client is not None:
            return _client
        settings = get_settings()
        supabase_url = url or settings.supabase_url
        supabase_key = key or settings.supabase_service_key
        if not supabase_url or not supabase_key:
            _client = InMemorySupabaseClient()  # type: ignore[assignment]
            return _client  # type: ignore[return-value]
        _client = create_client(supabase_url, supabase_key)
        return _client


def reset_supabase_client() -> None:
    global _client
    with _client_lock:
        if _client is not None and hasattr(_client, "postgrest_client"):
            try:
                _client.postgrest_client.close()  # type: ignore[attr-defined]
            except Exception:
                pass
        _client = None


__all__ = ["get_supabase_client", "reset_supabase_client", "InMemorySupabaseClient"]
