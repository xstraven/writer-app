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
    """
    CREATE TABLE IF NOT EXISTS public.campaigns (
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
        language TEXT DEFAULT 'en',
        created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
        updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_campaigns_invite ON public.campaigns(invite_code)",
    """
    CREATE TABLE IF NOT EXISTS public.players (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        name TEXT NOT NULL,
        session_token TEXT,
        character_sheet TEXT,
        is_gm BOOLEAN DEFAULT FALSE,
        turn_position INTEGER,
        joined_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
        last_active_at TIMESTAMPTZ
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_players_campaign ON public.players(campaign_id)",
    "CREATE INDEX IF NOT EXISTS idx_players_session ON public.players(session_token)",
    """
    CREATE TABLE IF NOT EXISTS public.campaign_actions (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        player_id TEXT,
        action_type TEXT NOT NULL,
        content TEXT NOT NULL,
        action_results TEXT,
        turn_number INTEGER,
        created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_actions_campaign ON public.campaign_actions(campaign_id)",
]


def main() -> int:
    conn_str = os.getenv("STORYCRAFT_NEON_DATABASE_URL")
    if not conn_str:
        print("STORYCRAFT_NEON_DATABASE_URL is not set; cannot create tables.", file=sys.stderr)
        return 1

    try:
        with psycopg.connect(conn_str, autocommit=True) as conn:
            with conn.cursor() as cur:
                for statement in DDL_STATEMENTS:
                    cur.execute(statement)
    except Exception as exc:  # pragma: no cover - setup script diagnostics
        print(f"Failed to apply Neon schema: {exc}", file=sys.stderr)
        return 1

    print("Neon tables are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
