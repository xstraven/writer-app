from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .config import get_settings
from .runtime import (
    base_settings_store,
    lorebook_store,
    snippet_store,
    state_store,
    story_settings_store,
)
from .routes.campaigns import router as campaigns_router
from .routes.generation import router as generation_router
from .routes.health import router as health_router
from .routes.lorebook import router as lorebook_router
from .routes.rpg_mode import router as rpg_router
from .routes.simple_rpg import router as simple_rpg_router
from .routes.snippets import router as snippets_router
from .routes.state import router as state_router
from .routes.stories import router as stories_router
from .routes.story_settings import router as story_settings_router
from .routes.turns import router as turns_router


settings = get_settings()
app = FastAPI(title="Storycraft API", version="0.1.0")

cors_config = {
    "allow_origins": settings.cors_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

if settings.cors_origin_regex:
    cors_config["allow_origin_regex"] = settings.cors_origin_regex

app.add_middleware(CORSMiddleware, **cors_config)

# Create images directory and mount for serving
IMAGES_DIR = Path("./data/images")
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

app.include_router(health_router)
app.include_router(state_router)
app.include_router(story_settings_router)
app.include_router(lorebook_router)
app.include_router(generation_router)
app.include_router(snippets_router)
app.include_router(stories_router)
app.include_router(rpg_router)
app.include_router(simple_rpg_router)
app.include_router(campaigns_router)
app.include_router(turns_router)


# Re-export runtime stores for backward compatibility in tests
store = lorebook_store

__all__ = [
    "app",
    "base_settings_store",
    "lorebook_store",
    "snippet_store",
    "state_store",
    "story_settings_store",
    "store",
]
