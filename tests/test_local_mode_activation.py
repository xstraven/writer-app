from __future__ import annotations

import os

import pytest

from storycraft.app.services.duckdb_client import DuckDBSupabaseClient
from storycraft.app.services.supabase_client import (
    InMemorySupabaseClient,
    get_supabase_client,
    reset_supabase_client,
)


@pytest.fixture(autouse=True)
def reset_client():
    """Reset the singleton client before and after each test."""
    reset_supabase_client()
    yield
    reset_supabase_client()


def test_test_mode_uses_in_memory_client(monkeypatch):
    """Test that tests automatically use in-memory client."""
    # PYTEST_CURRENT_TEST is automatically set by pytest
    # We'll verify it's set and uses in-memory
    assert os.getenv("PYTEST_CURRENT_TEST") is not None

    # Remove Supabase credentials to ensure we're not using them
    monkeypatch.delenv("STORYCRAFT_SUPABASE_URL", raising=False)
    monkeypatch.delenv("STORYCRAFT_SUPABASE_SERVICE_KEY", raising=False)

    reset_supabase_client()
    client = get_supabase_client()

    # Verify it's in-memory client
    assert isinstance(client, InMemorySupabaseClient)


def test_local_mode_uses_duckdb_without_credentials(monkeypatch, tmp_path):
    """Test that DuckDB client is used when Supabase credentials are missing."""
    from storycraft.app.config import get_settings

    # Remove test mode env var
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Remove Supabase credentials
    monkeypatch.delenv("STORYCRAFT_SUPABASE_URL", raising=False)
    monkeypatch.delenv("STORYCRAFT_SUPABASE_SERVICE_KEY", raising=False)

    # Set DuckDB path
    monkeypatch.setenv("STORYCRAFT_DUCKDB_PATH", str(tmp_path / "test.duckdb"))

    # Clear settings cache
    get_settings.cache_clear()

    reset_supabase_client()
    client = get_supabase_client()

    # Verify it's DuckDB client
    assert isinstance(client, DuckDBSupabaseClient)
    assert client.db_path == tmp_path / "test.duckdb"


def test_duckdb_client_basic_operations(monkeypatch, tmp_path):
    """Test that DuckDB client works correctly when auto-detected."""
    from storycraft.app.config import get_settings

    # Remove test mode env var
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Remove Supabase credentials
    monkeypatch.delenv("STORYCRAFT_SUPABASE_URL", raising=False)
    monkeypatch.delenv("STORYCRAFT_SUPABASE_SERVICE_KEY", raising=False)

    # Set DuckDB path
    monkeypatch.setenv("STORYCRAFT_DUCKDB_PATH", str(tmp_path / "test.duckdb"))

    # Clear settings cache
    get_settings.cache_clear()

    reset_supabase_client()
    client = get_supabase_client()

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
    """Test that store classes work with DuckDB backend."""
    from storycraft.app.config import get_settings
    from storycraft.app.snippet_store import SnippetStore

    # Remove test mode env var
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Remove Supabase credentials
    monkeypatch.delenv("STORYCRAFT_SUPABASE_URL", raising=False)
    monkeypatch.delenv("STORYCRAFT_SUPABASE_SERVICE_KEY", raising=False)

    # Set DuckDB path
    monkeypatch.setenv("STORYCRAFT_DUCKDB_PATH", str(tmp_path / "test.duckdb"))

    # Clear settings cache
    get_settings.cache_clear()

    reset_supabase_client()
    client = get_supabase_client()

    # Create store with DuckDB client
    store = SnippetStore(client=client)

    # Test basic store operations
    story = "Test Story"
    root = store.create_snippet(story=story, content="Root", kind="user", parent_id=None)
    assert root.parent_id is None
    assert root.content == "Root"

    # Create child
    child = store.create_snippet(story=story, content="Child", kind="ai", parent_id=root.id)
    assert child.parent_id == root.id

    # Verify parent's child_id was updated
    updated_root = store.get(root.id)
    assert updated_root is not None
    assert updated_root.child_id == child.id

    # List children
    children = store.list_children(story, root.id)
    assert len(children) == 1
    assert children[0].id == child.id


def test_singleton_behavior_across_calls(monkeypatch, tmp_path):
    """Test that get_supabase_client returns the same instance."""
    from storycraft.app.config import get_settings

    # Remove test mode env var
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    # Remove Supabase credentials
    monkeypatch.delenv("STORYCRAFT_SUPABASE_URL", raising=False)
    monkeypatch.delenv("STORYCRAFT_SUPABASE_SERVICE_KEY", raising=False)

    # Set DuckDB path
    monkeypatch.setenv("STORYCRAFT_DUCKDB_PATH", str(tmp_path / "test.duckdb"))

    # Clear settings cache
    get_settings.cache_clear()

    reset_supabase_client()

    client1 = get_supabase_client()
    client2 = get_supabase_client()

    # Should be the same instance
    assert client1 is client2
