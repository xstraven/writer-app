from __future__ import annotations

import os
import uuid

import pytest

from storycraft.app.services.neon_client import NeonClient


@pytest.mark.skipif(
    not os.getenv("STORYCRAFT_NEON_DATABASE_URL"),
    reason="STORYCRAFT_NEON_DATABASE_URL is not configured",
)
def test_neon_client_smoke_query_ops() -> None:
    database_url = os.environ["STORYCRAFT_NEON_DATABASE_URL"]
    client = NeonClient(database_url)

    key = f"neon-smoke-{uuid.uuid4().hex}"

    inserted = client.table("app_state").upsert(
        {"key": key, "value": '{"smoke": true}'},
        on_conflict="key",
    ).execute()
    assert len(inserted.data) == 1

    selected = client.table("app_state").select("key,value").eq("key", key).limit(1).execute()
    assert len(selected.data) == 1
    assert selected.data[0]["key"] == key

    updated = client.table("app_state").update({"value": '{"smoke": false}'}).eq("key", key).execute()
    assert len(updated.data) == 1

    deleted = client.table("app_state").delete().eq("key", key).execute()
    assert len(deleted.data) == 1
