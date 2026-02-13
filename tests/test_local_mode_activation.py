from __future__ import annotations

import os

import pytest

from storycraft.app.services.duckdb_client import DuckDBClient
from storycraft.app.services.persistence_client import (
    InMemoryClient,
    get_persistence_client,
    reset_persistence_client,
)


@pytest.fixture(autouse=True)
def reset_client():
    """Reset the singleton client before and after each test."""
    reset_persistence_client()
    yield
    reset_persistence_client()


def test_test_mode_uses_in_memory_client(monkeypatch):
    """Test that tests automatically use in-memory client."""
    # PYTEST_CURRENT_TEST is automatically set by pytest
    # We'll verify it's set and uses in-memory
    assert os.getenv("PYTEST_CURRENT_TEST") is not None

    # Remove Neon URL to ensure we're not using it
    monkeypatch.delenv("STORYCRAFT_NEON_DATABASE_URL", raising=False)

    reset_persistence_client()
    client = get_persistence_client()

    # Verify it's in-memory client
    assert isinstance(client, InMemoryClient)


def test_local_mode_uses_duckdb_without_credentials(monkeypatch, tmp_path):
    """Test that DuckDB client is used when Neon URL is missing."""
    from storycraft.app.config import get_settings

    # Remove test mode env var
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Remove Neon URL
    monkeypatch.delenv("STORYCRAFT_NEON_DATABASE_URL", raising=False)

    # Set DuckDB path
    monkeypatch.setenv("STORYCRAFT_DUCKDB_PATH", str(tmp_path / "test.duckdb"))

    # Clear settings cache
    get_settings.cache_clear()

    reset_persistence_client()
    client = get_persistence_client()

    # Verify it's DuckDB client
    assert isinstance(client, DuckDBClient)
    assert client.db_path == tmp_path / "test.duckdb"


def test_duckdb_client_basic_operations(monkeypatch, tmp_path):
    """Test that DuckDB client works correctly when auto-detected."""
    from storycraft.app.config import get_settings

    # Remove test mode env var
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Remove Neon URL
    monkeypatch.delenv("STORYCRAFT_NEON_DATABASE_URL", raising=False)

    # Set DuckDB path
    monkeypatch.setenv("STORYCRAFT_DUCKDB_PATH", str(tmp_path / "test.duckdb"))

    # Clear settings cache
    get_settings.cache_clear()

    reset_persistence_client()
    client = get_persistence_client()

    # Verify basic operations work
    result = client.table("snippets").insert({
        "id": "test-1",
        "story": "Test Story",
        "parent_id": None,
        "child_id": None,
        "kind": "user",
        "content": "Test content",
    }).execute()

    assert len(result.data) == 1
    assert result.data[0]["id"] == "test-1"

    # Verify we can query it back
    result = client.table("snippets").select("*").eq("id", "test-1").execute()
    assert len(result.data) == 1
    assert result.data[0]["content"] == "Test content"


def test_store_integration_with_duckdb(monkeypatch, tmp_path):
    """Test that RPG store classes work with DuckDB backend."""
    from storycraft.app.config import get_settings
    from storycraft.app.campaign_action_store import CampaignActionStore
    from storycraft.app.campaign_store import CampaignStore
    from storycraft.app.player_store import PlayerStore

    # Remove test mode env var
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Remove Neon URL
    monkeypatch.delenv("STORYCRAFT_NEON_DATABASE_URL", raising=False)

    # Set DuckDB path
    monkeypatch.setenv("STORYCRAFT_DUCKDB_PATH", str(tmp_path / "test.duckdb"))

    # Clear settings cache
    get_settings.cache_clear()

    reset_persistence_client()
    client = get_persistence_client()

    campaign_store = CampaignStore(client=client)
    player_store = PlayerStore(client=client)
    action_store = CampaignActionStore(client=client)

    campaign = campaign_store.create(
        name="Local Test Campaign",
        world_setting="A windswept archipelago",
        created_by="creator-1",
        language="en",
    )
    assert campaign.id
    assert campaign.status == "lobby"

    player = player_store.create(
        campaign_id=campaign.id,
        name="Alice",
        session_token="session-1",
    )
    assert player.campaign_id == campaign.id

    action = action_store.create(
        campaign_id=campaign.id,
        action_type="player_action",
        content="I scout the lighthouse.",
        player_id=player.id,
        turn_number=1,
    )
    assert action.campaign_id == campaign.id

    history = action_store.get_by_campaign(campaign.id)
    assert len(history) == 1
    assert history[0].id == action.id


def test_singleton_behavior_across_calls(monkeypatch, tmp_path):
    """Test that get_persistence_client returns the same instance."""
    from storycraft.app.config import get_settings

    # Remove test mode env var
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Remove Neon URL
    monkeypatch.delenv("STORYCRAFT_NEON_DATABASE_URL", raising=False)

    # Set DuckDB path
    monkeypatch.setenv("STORYCRAFT_DUCKDB_PATH", str(tmp_path / "test.duckdb"))

    # Clear settings cache
    get_settings.cache_clear()

    reset_persistence_client()

    client1 = get_persistence_client()
    client2 = get_persistence_client()

    # Should be the same instance
    assert client1 is client2
