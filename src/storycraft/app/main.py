from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .config import get_settings
from .runtime import campaign_action_store, campaign_store, player_store
from .routes.campaigns import router as campaigns_router
from .routes.health import router as health_router
from .routes.simple_rpg import router as simple_rpg_router
from .routes.turns import router as turns_router
from .routes.world_building import router as world_building_router


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
app.include_router(simple_rpg_router)
app.include_router(campaigns_router)
app.include_router(turns_router)
app.include_router(world_building_router)


__all__ = [
    "app",
    "campaign_store",
    "player_store",
    "campaign_action_store",
]
