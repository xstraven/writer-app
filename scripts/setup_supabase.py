from __future__ import annotations

import os
import sys

import psycopg

DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS public.snippets (
        id TEXT PRIMARY KEY,
        story TEXT NOT NULL,
        parent_id TEXT,
        child_id TEXT,
        kind TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_snippets_story ON public.snippets(story)",
    "CREATE INDEX IF NOT EXISTS idx_snippets_story_parent ON public.snippets(story, parent_id)",
    """
    CREATE TABLE IF NOT EXISTS public.branches (
        story TEXT NOT NULL,
        name TEXT NOT NULL,
        head_id TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
        PRIMARY KEY (story, name)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS public.lorebook (
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
    "CREATE INDEX IF NOT EXISTS idx_lore_story ON public.lorebook(story)",
    """
    CREATE TABLE IF NOT EXISTS public.story_settings (
        story TEXT PRIMARY KEY,
        data TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS public.app_state (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """,
]


def main() -> int:
    conn_str = os.getenv("STORYCRAFT_SUPABASE_DB_URL")
    if not conn_str:
        print("STORYCRAFT_SUPABASE_DB_URL is not set; cannot create tables.", file=sys.stderr)
        return 1

    try:
        with psycopg.connect(conn_str, autocommit=True) as conn:
            with conn.cursor() as cur:
                for statement in DDL_STATEMENTS:
                    cur.execute(statement)
    except Exception as exc:  # pragma: no cover - setup script diagnostics
        print(f"Failed to apply Supabase schema: {exc}", file=sys.stderr)
        return 1

    print("Supabase tables are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
