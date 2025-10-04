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

    # Server
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    cors_origin_regex: Optional[str] = r"https://.*\.vercel\.app"

    # Storage
    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
