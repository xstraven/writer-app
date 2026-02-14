from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

BASE_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = BASE_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.append(str(SRC_DIR))

from storycraft.app.db.metadata import metadata  # noqa: E402
from storycraft.app.db import models as _models  # noqa: F401,E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = metadata


def _normalize_sqlalchemy_url(db_url: str) -> str:
    # Allow common Postgres URL variants while always using psycopg (v3).
    if db_url.startswith("postgres://"):
        db_url = "postgresql://" + db_url[len("postgres://") :]
    if db_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + db_url[len("postgresql://") :]
    return db_url


def _resolve_database_url() -> str:
    x_args = context.get_x_argument(as_dictionary=True)
    db_url = x_args.get("db_url") if x_args else None
    if not db_url:
        db_url = os.getenv("STORYCRAFT_NEON_DATABASE_URL")
    if not db_url:
        db_url = config.get_main_option("sqlalchemy.url")
    if not db_url:
        raise RuntimeError(
            "Database URL is required. Set STORYCRAFT_NEON_DATABASE_URL or pass -x db_url=..."
        )
    return _normalize_sqlalchemy_url(db_url)


def run_migrations_offline() -> None:
    url = _resolve_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _resolve_database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
