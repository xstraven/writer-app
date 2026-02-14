from __future__ import annotations

import os
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config


def main() -> int:
    conn_str = os.getenv("STORYCRAFT_NEON_DATABASE_URL")
    if not conn_str:
        print("STORYCRAFT_NEON_DATABASE_URL is not set; cannot run migrations.", file=sys.stderr)
        return 1

    repo_root = Path(__file__).resolve().parents[1]
    alembic_ini = repo_root / "alembic.ini"
    if not alembic_ini.exists():
        print(f"Alembic config missing: {alembic_ini}", file=sys.stderr)
        return 1

    try:
        cfg = Config(str(alembic_ini))
        cfg.set_main_option("sqlalchemy.url", conn_str)
        command.upgrade(cfg, "head")
    except Exception as exc:  # pragma: no cover - setup script diagnostics
        print(f"Failed to run migrations: {exc}", file=sys.stderr)
        return 1

    print("Neon migrations applied.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

