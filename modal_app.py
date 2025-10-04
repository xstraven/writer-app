from __future__ import annotations

import sys
from pathlib import Path

import modal

APP_NAME = "storycraft-backend"
ENV_SECRET_NAME = "storycraft-backend-env"

repo_root = Path(__file__).parent

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "fastapi>=0.111",
        "uvicorn>=0.30",
        "pydantic>=2.8",
        "pydantic-settings>=2.4",
        "httpx>=0.27",
        "python-multipart>=0.0.9",
        "supabase>=2.21.1",
        "psycopg[binary]>=3.2",
    )
    .add_local_dir(local_path=str(repo_root / "src"), remote_path="/root/app/src")
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
