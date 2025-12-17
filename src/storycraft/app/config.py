from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="STORYCRAFT_", extra="ignore")

    # OpenRouter
    openrouter_api_key: Optional[str] = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_default_model: str = "deepseek/deepseek-chat-v3-0324"

    # Server - CORS origins configured via environment variable (comma-separated)
    # Default to localhost for development
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    # Optional regex pattern for matching additional origins (e.g., dynamic Vercel deployments)
    cors_origin_regex: Optional[str] = None

    # Storage
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None

    # Local DuckDB database path (used when Supabase credentials not configured)
    duckdb_path: str = "./data/storycraft.duckdb"


@lru_cache
def get_settings() -> Settings:
    return Settings()
