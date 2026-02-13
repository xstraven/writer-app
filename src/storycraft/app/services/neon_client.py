from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from typing import Any, Callable, Optional

import psycopg
from psycopg import sql
from psycopg.rows import dict_row


_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@dataclass
class _NeonResult:
    data: list[dict[str, Any]]


class _NeonQuery:
    def __init__(
        self,
        client: "NeonClient",
        table_name: str,
        *,
        action: str,
        payload: Any = None,
        on_conflict: Optional[str] = None,
    ) -> None:
        self._client = client
        self._table = table_name
        self._action = action
        self._payload = payload
        self._filters: list[tuple[str, Any]] = []
        self._order: Optional[tuple[str, bool]] = None
        self._limit: Optional[int] = None
        self._on_conflict = on_conflict
        self._select_columns = "*"

    def select(self, columns: str = "*") -> "_NeonQuery":
        self._select_columns = columns
        self._action = "select"
        return self

    def eq(self, column: str, value: Any) -> "_NeonQuery":
        self._client._validate_identifier(column)
        self._filters.append((column, value))
        return self

    def order(self, column: str, *, desc: bool = False) -> "_NeonQuery":
        self._client._validate_identifier(column)
        self._order = (column, desc)
        return self

    def limit(self, value: int) -> "_NeonQuery":
        self._limit = value
        return self

    def insert(self, payload: Any) -> "_NeonQuery":
        return _NeonQuery(self._client, self._table, action="insert", payload=payload)

    def update(self, payload: dict[str, Any]) -> "_NeonQuery":
        query = _NeonQuery(self._client, self._table, action="update", payload=payload)
        query._filters = list(self._filters)
        return query

    def delete(self) -> "_NeonQuery":
        query = _NeonQuery(self._client, self._table, action="delete")
        query._filters = list(self._filters)
        return query

    def upsert(self, payload: Any, *, on_conflict: Optional[str] = None) -> "_NeonQuery":
        return _NeonQuery(
            self._client,
            self._table,
            action="upsert",
            payload=payload,
            on_conflict=on_conflict,
        )

    def _build_where(self) -> tuple[sql.Composable, list[Any]]:
        if not self._filters:
            return sql.SQL(""), []
        clauses: list[sql.Composable] = []
        params: list[Any] = []
        for col, val in self._filters:
            clauses.append(sql.SQL("{} = %s").format(sql.Identifier(col)))
            params.append(val)
        return sql.SQL(" WHERE ") + sql.SQL(" AND ").join(clauses), params

    def _select_columns_sql(self) -> sql.Composable:
        columns = self._select_columns.strip()
        if columns == "*":
            return sql.SQL("*")
        pieces = [part.strip() for part in columns.split(",") if part.strip()]
        if not pieces:
            return sql.SQL("*")
        for piece in pieces:
            self._client._validate_identifier(piece)
        return sql.SQL(", ").join(sql.Identifier(piece) for piece in pieces)

    def execute(self) -> _NeonResult:
        self._client._validate_identifier(self._table)

        def _run(cur: psycopg.Cursor[Any]) -> _NeonResult:
            if self._action == "select":
                query = sql.SQL("SELECT {} FROM {}").format(
                    self._select_columns_sql(),
                    sql.Identifier(self._table),
                )
                where_sql, params = self._build_where()
                query += where_sql
                if self._order:
                    col, is_desc = self._order
                    query += sql.SQL(" ORDER BY {} {}").format(
                        sql.Identifier(col),
                        sql.SQL("DESC" if is_desc else "ASC"),
                    )
                if self._limit is not None:
                    query += sql.SQL(" LIMIT %s")
                    params.append(self._limit)
                cur.execute(query, params)
                return _NeonResult(list(cur.fetchall()))

            if self._action == "insert":
                rows = self._payload if isinstance(self._payload, list) else [self._payload]
                out: list[dict[str, Any]] = []
                for row in rows:
                    if not isinstance(row, dict) or not row:
                        continue
                    columns = list(row.keys())
                    for col in columns:
                        self._client._validate_identifier(col)
                    query = sql.SQL("INSERT INTO {} ({}) VALUES ({}) RETURNING *").format(
                        sql.Identifier(self._table),
                        sql.SQL(", ").join(sql.Identifier(col) for col in columns),
                        sql.SQL(", ").join(sql.SQL("%s") for _ in columns),
                    )
                    cur.execute(query, [row[col] for col in columns])
                    out.extend(cur.fetchall())
                return _NeonResult(out)

            if self._action == "update":
                if not self._payload:
                    return _NeonResult([])

                set_columns = list(self._payload.keys())
                for col in set_columns:
                    self._client._validate_identifier(col)
                query = sql.SQL("UPDATE {} SET {}").format(
                    sql.Identifier(self._table),
                    sql.SQL(", ").join(
                        sql.SQL("{} = %s").format(sql.Identifier(col)) for col in set_columns
                    ),
                )
                params = [self._payload[col] for col in set_columns]
                where_sql, where_params = self._build_where()
                query += where_sql
                params.extend(where_params)
                query += sql.SQL(" RETURNING *")
                cur.execute(query, params)
                return _NeonResult(list(cur.fetchall()))

            if self._action == "delete":
                query = sql.SQL("DELETE FROM {}").format(sql.Identifier(self._table))
                where_sql, params = self._build_where()
                query += where_sql
                query += sql.SQL(" RETURNING *")
                cur.execute(query, params)
                return _NeonResult(list(cur.fetchall()))

            if self._action == "upsert":
                rows = self._payload if isinstance(self._payload, list) else [self._payload]
                out: list[dict[str, Any]] = []
                conflict_keys: list[str] = []
                if self._on_conflict:
                    conflict_keys = [k.strip() for k in self._on_conflict.split(",") if k.strip()]
                    for key in conflict_keys:
                        self._client._validate_identifier(key)

                for row in rows:
                    if not isinstance(row, dict) or not row:
                        continue
                    columns = list(row.keys())
                    for col in columns:
                        self._client._validate_identifier(col)

                    base = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                        sql.Identifier(self._table),
                        sql.SQL(", ").join(sql.Identifier(col) for col in columns),
                        sql.SQL(", ").join(sql.SQL("%s") for _ in columns),
                    )
                    params = [row[col] for col in columns]

                    if conflict_keys:
                        update_columns = [col for col in columns if col not in conflict_keys]
                        if update_columns:
                            query = base + sql.SQL(" ON CONFLICT ({}) DO UPDATE SET {}").format(
                                sql.SQL(", ").join(sql.Identifier(key) for key in conflict_keys),
                                sql.SQL(", ").join(
                                    sql.SQL("{} = EXCLUDED.{}").format(
                                        sql.Identifier(col),
                                        sql.Identifier(col),
                                    )
                                    for col in update_columns
                                ),
                            )
                        else:
                            query = base + sql.SQL(" ON CONFLICT ({}) DO NOTHING").format(
                                sql.SQL(", ").join(sql.Identifier(key) for key in conflict_keys)
                            )
                    else:
                        query = base

                    query += sql.SQL(" RETURNING *")
                    cur.execute(query, params)
                    out.extend(cur.fetchall())

                return _NeonResult(out)

            raise RuntimeError(f"Unsupported Neon action: {self._action}")

        return self._client._run_query(_run)


class _NeonTable:
    def __init__(self, client: "NeonClient", name: str) -> None:
        self._client = client
        self._name = name

    def select(self, columns: str = "*") -> _NeonQuery:
        query = _NeonQuery(self._client, self._name, action="select")
        query._select_columns = columns
        return query

    def insert(self, payload: Any) -> _NeonQuery:
        return _NeonQuery(self._client, self._name, action="insert", payload=payload)

    def update(self, payload: dict[str, Any]) -> _NeonQuery:
        return _NeonQuery(self._client, self._name, action="update", payload=payload)

    def delete(self) -> _NeonQuery:
        return _NeonQuery(self._client, self._name, action="delete")

    def upsert(self, payload: Any, *, on_conflict: Optional[str] = None) -> _NeonQuery:
        return _NeonQuery(self._client, self._name, action="upsert", payload=payload, on_conflict=on_conflict)


class _NeonTransactionContext:
    def __init__(self, client: "NeonClient") -> None:
        self._client = client

    def __enter__(self) -> "_NeonTransactionContext":
        self._client.begin_transaction()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type is not None:
            self._client.rollback()
            return False
        self._client.commit()
        return False


class NeonClient:
    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise ValueError("Neon database URL is required")
        self._database_url = database_url
        self._local = threading.local()

    def _validate_identifier(self, name: str) -> None:
        if not _IDENT_RE.match(name):
            raise ValueError(f"Invalid identifier: {name}")

    def _transaction_connection(self) -> Optional[psycopg.Connection[Any]]:
        return getattr(self._local, "tx_conn", None)

    def begin_transaction(self) -> None:
        if self._transaction_connection() is not None:
            return
        conn = psycopg.connect(self._database_url, row_factory=dict_row)
        conn.autocommit = False
        self._local.tx_conn = conn

    def commit(self) -> None:
        conn = self._transaction_connection()
        if conn is None:
            return
        conn.commit()
        conn.close()
        self._local.tx_conn = None

    def rollback(self) -> None:
        conn = self._transaction_connection()
        if conn is None:
            return
        conn.rollback()
        conn.close()
        self._local.tx_conn = None

    def transaction(self) -> _NeonTransactionContext:
        return _NeonTransactionContext(self)

    def _run_query(self, fn: Callable[[psycopg.Cursor[Any]], _NeonResult]) -> _NeonResult:
        conn = self._transaction_connection()
        if conn is not None:
            with conn.cursor() as cur:
                return fn(cur)

        with psycopg.connect(self._database_url, autocommit=True, row_factory=dict_row) as temp_conn:
            with temp_conn.cursor() as cur:
                return fn(cur)

    def table(self, name: str) -> _NeonTable:
        self._validate_identifier(name)
        return _NeonTable(self, name)

    def close(self) -> None:
        conn = self._transaction_connection()
        if conn is None:
            return
        try:
            conn.close()
        finally:
            self._local.tx_conn = None


__all__ = ["NeonClient"]
