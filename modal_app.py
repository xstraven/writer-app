from __future__ import annotations

import sys
from pathlib import Path

import modal

APP_NAME = "storycraft-backend"
ENV_SECRET_NAME = "storycraft-backend-env"

repo_root = Path(__file__).parent

image = (
    modal.Image.debian_slim(python_version="3.13")
    .uv_sync()
    .add_local_dir(
        local_path=str(repo_root / "src"), remote_path="/root/app/src"
    )
)

app = modal.App(APP_NAME)


@app.function(image=image, secrets=[modal.Secret.from_name(ENV_SECRET_NAME)])
@modal.asgi_app()
def fastapi_app():
    src_path = Path("/root/app/src")
    if str(src_path) not in sys.path:
        sys.path.append(str(src_path))
    from storycraft.app.main import app as fastapi_application

    return fastapi_application
