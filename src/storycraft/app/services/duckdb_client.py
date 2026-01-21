from __future__ import annotations

import shutil
import threading
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import duckdb

DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        story TEXT NOT NULL,
        parent_id TEXT,
        child_id TEXT,
        kind TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_snippets_story ON snippets(story)",
    "CREATE INDEX IF NOT EXISTS idx_snippets_story_parent ON snippets(story, parent_id)",
    """
    CREATE TABLE IF NOT EXISTS branches (
        story TEXT NOT NULL,
        name TEXT NOT NULL,
        head_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (story, name)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS lorebook (
        id TEXT PRIMARY KEY,
        story TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        tags TEXT,
        keys TEXT,
        always_on BOOLEAN DEFAULT FALSE
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_lore_story ON lorebook(story)",
    """
    CREATE TABLE IF NOT EXISTS story_settings (
        story TEXT PRIMARY KEY,
        data TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """,
    # Campaign tables for Group RPG
    """
    CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        world_setting TEXT NOT NULL,
        game_system TEXT,
        created_by TEXT NOT NULL,
        invite_code TEXT UNIQUE,
        status TEXT DEFAULT 'active',
        current_turn_player_id TEXT,
        turn_order TEXT,
        turn_number INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_campaigns_invite ON campaigns(invite_code)",
    """
    CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        name TEXT NOT NULL,
        session_token TEXT,
        character_sheet TEXT,
        is_gm BOOLEAN DEFAULT FALSE,
        turn_position INTEGER,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_players_campaign ON players(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_token)",
    """
    CREATE TABLE IF NOT EXISTS campaign_actions (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        player_id TEXT,
        action_type TEXT NOT NULL,
        content TEXT NOT NULL,
        action_results TEXT,
        turn_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_actions_campaign ON campaign_actions(campaign_id)",
]


@dataclass
class _DuckDBResult:
    data: List[Dict[str, Any]]


# Tables that have a created_at column
_TABLES_WITH_CREATED_AT = {"snippets", "branches", "campaigns", "campaign_actions"}


class _DuckDBQuery:
    def __init__(
        self,
        client: DuckDBSupabaseClient,
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
        self._filters: List[tuple[str, Any]] = []
        self._order: Optional[tuple[str, bool]] = None
        self._limit: Optional[int] = None
        self._on_conflict = on_conflict
        self._select_columns = "*"

    def select(self, columns: str = "*") -> _DuckDBQuery:
        self._select_columns = columns
        self._action = "select"
        return self

    def eq(self, column: str, value: Any) -> _DuckDBQuery:
        self._filters.append((column, value))
        return self

    def order(self, column: str, *, desc: bool = False) -> _DuckDBQuery:
        self._order = (column, desc)
        return self

    def limit(self, value: int) -> _DuckDBQuery:
        self._limit = value
        return self

    def insert(self, payload: Any) -> _DuckDBQuery:
        return _DuckDBQuery(self._client, self._table, action="insert", payload=payload)

    def update(self, payload: Dict[str, Any]) -> _DuckDBQuery:
        query = _DuckDBQuery(self._client, self._table, action="update", payload=payload)
        query._filters = list(self._filters)
        return query

    def delete(self) -> _DuckDBQuery:
        query = _DuckDBQuery(self._client, self._table, action="delete")
        query._filters = list(self._filters)
        return query

    def upsert(self, payload: Any, *, on_conflict: Optional[str] = None) -> _DuckDBQuery:
        return _DuckDBQuery(
            self._client,
            self._table,
            action="upsert",
            payload=payload,
            on_conflict=on_conflict,
        )

    def _ensure_created_at(self, row: Dict[str, Any]) -> None:
        """Add created_at to row if the table has that column and it's not already set."""
        if self._table in _TABLES_WITH_CREATED_AT and "created_at" not in row:
            row["created_at"] = datetime.now(tz=timezone.utc).isoformat()

    def execute(self) -> _DuckDBResult:
        # Connection is reused across queries (thread-local persistent connection)
        conn = self._client._get_connection()

        if self._action == "select":
            # Build SELECT query
            query = f"SELECT {self._select_columns} FROM {self._table}"
            params = []

            if self._filters:
                where_clauses = [f"{col} = ?" for col, _ in self._filters]
                query += " WHERE " + " AND ".join(where_clauses)
                params.extend([val for _, val in self._filters])

            if self._order:
                col, desc = self._order
                query += f" ORDER BY {col} {'DESC' if desc else 'ASC'}"

            if self._limit is not None:
                query += f" LIMIT {self._limit}"

            cursor = conn.execute(query, params)
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            data = [dict(zip(columns, row)) for row in rows]
            return _DuckDBResult(data)

        elif self._action == "insert":
            # Handle both single dict and list of dicts
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            out = []

            for row in rows:
                record = deepcopy(row)
                self._ensure_created_at(record)

                columns = list(record.keys())
                placeholders = ", ".join(["?" for _ in columns])
                query = f"INSERT INTO {self._table} ({', '.join(columns)}) VALUES ({placeholders})"
                values = [record[col] for col in columns]

                conn.execute(query, values)
                out.append(deepcopy(record))

            return _DuckDBResult(out)

        elif self._action == "update":
            # Build UPDATE query
            if not self._payload:
                return _DuckDBResult([])

            set_clause = ", ".join([f"{col} = ?" for col in self._payload.keys()])
            query = f"UPDATE {self._table} SET {set_clause}"
            params = list(self._payload.values())

            if self._filters:
                where_clauses = [f"{col} = ?" for col, _ in self._filters]
                query += " WHERE " + " AND ".join(where_clauses)
                params.extend([val for _, val in self._filters])

            conn.execute(query, params)

            # Fetch updated rows to return
            select_query = f"SELECT * FROM {self._table}"
            if self._filters:
                where_clauses = [f"{col} = ?" for col, _ in self._filters]
                select_query += " WHERE " + " AND ".join(where_clauses)
                select_params = [val for _, val in self._filters]
                cursor = conn.execute(select_query, select_params)
            else:
                cursor = conn.execute(select_query)

            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            data = [dict(zip(columns, row)) for row in rows]
            return _DuckDBResult(data)

        elif self._action == "delete":
            # First fetch rows to return
            select_query = f"SELECT * FROM {self._table}"
            params = []

            if self._filters:
                where_clauses = [f"{col} = ?" for col, _ in self._filters]
                select_query += " WHERE " + " AND ".join(where_clauses)
                params = [val for _, val in self._filters]

            cursor = conn.execute(select_query, params)
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            data = [dict(zip(columns, row)) for row in rows]

            # Now delete
            delete_query = f"DELETE FROM {self._table}"
            if self._filters:
                where_clauses = [f"{col} = ?" for col, _ in self._filters]
                delete_query += " WHERE " + " AND ".join(where_clauses)

            conn.execute(delete_query, params)
            return _DuckDBResult(data)

        elif self._action == "upsert":
            # Handle both single dict and list of dicts
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            out: List[Dict[str, Any]] = []
            keys = []

            if self._on_conflict:
                keys = [key.strip() for key in self._on_conflict.split(",") if key.strip()]

            for row in rows:
                record = deepcopy(row)
                self._ensure_created_at(record)

                # Check if row exists
                if keys:
                    where_clauses = [f"{k} = ?" for k in keys]
                    check_query = f"SELECT * FROM {self._table} WHERE {' AND '.join(where_clauses)}"
                    check_params = [record.get(k) for k in keys]

                    cursor = conn.execute(check_query, check_params)
                    existing = cursor.fetchone()

                    if existing:
                        # UPDATE existing row
                        update_cols = [col for col in record.keys() if col not in keys]
                        if update_cols:
                            set_clause = ", ".join([f"{col} = ?" for col in update_cols])
                            update_query = f"UPDATE {self._table} SET {set_clause} WHERE {' AND '.join(where_clauses)}"
                            update_params = [record[col] for col in update_cols]
                            update_params.extend(check_params)
                            conn.execute(update_query, update_params)

                        # Fetch updated row
                        cursor = conn.execute(check_query, check_params)
                        updated = cursor.fetchone()
                        columns = [desc[0] for desc in cursor.description]
                        out.append(dict(zip(columns, updated)))
                    else:
                        # INSERT new row
                        columns = list(record.keys())
                        placeholders = ", ".join(["?" for _ in columns])
                        insert_query = f"INSERT INTO {self._table} ({', '.join(columns)}) VALUES ({placeholders})"
                        values = [record[col] for col in columns]
                        conn.execute(insert_query, values)
                        out.append(deepcopy(record))
                else:
                    # No conflict keys, just insert
                    columns = list(record.keys())
                    placeholders = ", ".join(["?" for _ in columns])
                    insert_query = f"INSERT INTO {self._table} ({', '.join(columns)}) VALUES ({placeholders})"
                    values = [record[col] for col in columns]
                    conn.execute(insert_query, values)
                    out.append(deepcopy(record))

            return _DuckDBResult(out)

        else:
            raise RuntimeError(f"Unsupported DuckDB action: {self._action}")


class _DuckDBTable:
    def __init__(self, client: DuckDBSupabaseClient, name: str) -> None:
        self._client = client
        self._name = name

    def select(self, columns: str = "*") -> _DuckDBQuery:
        query = _DuckDBQuery(self._client, self._name, action="select")
        query._select_columns = columns
        return query

    def insert(self, payload: Any) -> _DuckDBQuery:
        return _DuckDBQuery(self._client, self._name, action="insert", payload=payload)

    def update(self, payload: Dict[str, Any]) -> _DuckDBQuery:
        return _DuckDBQuery(self._client, self._name, action="update", payload=payload)

    def delete(self) -> _DuckDBQuery:
        return _DuckDBQuery(self._client, self._name, action="delete")

    def upsert(self, payload: Any, *, on_conflict: Optional[str] = None) -> _DuckDBQuery:
        return _DuckDBQuery(
            self._client, self._name, action="upsert", payload=payload, on_conflict=on_conflict
        )


class DuckDBSupabaseClient:
    def __init__(self, db_path: str = "./data/storycraft.duckdb") -> None:
        self.db_path = Path(db_path)
        # Thread-local storage for connections (one persistent connection per thread)
        self._local = threading.local()
        self._lock = threading.Lock()

        # Create data directory if it doesn't exist
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # Initialize database schema
        self._initialize_db()

    def begin_transaction(self) -> None:
        """Begin an explicit transaction."""
        conn = self._get_connection()
        conn.execute("BEGIN TRANSACTION")

    def commit(self) -> None:
        """Commit the current transaction."""
        conn = self._get_connection()
        conn.execute("COMMIT")

    def rollback(self) -> None:
        """Rollback the current transaction."""
        conn = self._get_connection()
        conn.execute("ROLLBACK")

    def transaction(self) -> "TransactionContext":
        """Context manager for transactions. Usage: with client.transaction(): ..."""
        return TransactionContext(self)

    def _initialize_db(self) -> None:
        """Create tables if they don't exist."""
        try:
            conn = duckdb.connect(str(self.db_path))

            # Apply schema
            for statement in DDL_STATEMENTS:
                conn.execute(statement)

            conn.close()
        except Exception as e:
            # Handle corrupted database
            if "corrupted" in str(e).lower() or "malformed" in str(e).lower():
                print(f"Warning: Database appears corrupted, recreating: {e}")
                # Backup corrupted file
                backup_path = self.db_path.with_suffix(".corrupted")
                if self.db_path.exists():
                    shutil.move(str(self.db_path), str(backup_path))
                # Retry
                conn = duckdb.connect(str(self.db_path))
                for statement in DDL_STATEMENTS:
                    conn.execute(statement)
                conn.close()
            else:
                raise

    def _get_connection(self) -> duckdb.DuckDBPyConnection:
        """Get a persistent connection for the current thread (reused across queries)."""
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = duckdb.connect(str(self.db_path))
            self._local.conn = conn
        return conn

    def close(self) -> None:
        """Close the connection for the current thread."""
        conn = getattr(self._local, "conn", None)
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass
            self._local.conn = None

    def table(self, name: str) -> _DuckDBTable:
        return _DuckDBTable(self, name)


class TransactionContext:
    """Context manager for database transactions."""

    def __init__(self, client: DuckDBSupabaseClient) -> None:
        self._client = client

    def __enter__(self) -> "TransactionContext":
        self._client.begin_transaction()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type is not None:
            self._client.rollback()
            return False  # Re-raise the exception
        self._client.commit()
        return False


__all__ = ["DuckDBSupabaseClient", "TransactionContext"]
