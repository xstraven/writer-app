from __future__ import annotations

import pytest

from storycraft.app.services.duckdb_client import DuckDBSupabaseClient


def test_duckdb_basic_insert_and_select(tmp_path):
    """Test basic insert and select operations with DuckDB client."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Test insert
    result = client.table("snippets").insert(
        {
            "id": "test-1",
            "story": "Test Story",
            "parent_id": None,
            "child_id": None,
            "kind": "user",
            "content": "Hello world",
        }
    ).execute()

    assert len(result.data) == 1
    assert result.data[0]["id"] == "test-1"
    assert result.data[0]["content"] == "Hello world"

    # Test select
    result = client.table("snippets").select("*").eq("id", "test-1").execute()
    assert len(result.data) == 1
    assert result.data[0]["content"] == "Hello world"


def test_duckdb_update(tmp_path):
    """Test update operation."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Insert a row
    client.table("snippets").insert(
        {
            "id": "test-1",
            "story": "Test Story",
            "parent_id": None,
            "child_id": None,
            "kind": "user",
            "content": "Original content",
        }
    ).execute()

    # Update the row
    result = client.table("snippets").update({"content": "Updated content"}).eq("id", "test-1").execute()

    # Verify update
    result = client.table("snippets").select("*").eq("id", "test-1").execute()
    assert len(result.data) == 1
    assert result.data[0]["content"] == "Updated content"


def test_duckdb_delete(tmp_path):
    """Test delete operation."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Insert a row
    client.table("snippets").insert(
        {
            "id": "test-1",
            "story": "Test Story",
            "parent_id": None,
            "child_id": None,
            "kind": "user",
            "content": "To be deleted",
        }
    ).execute()

    # Delete the row
    result = client.table("snippets").delete().eq("id", "test-1").execute()
    assert len(result.data) == 1
    assert result.data[0]["id"] == "test-1"

    # Verify deletion
    result = client.table("snippets").select("*").eq("id", "test-1").execute()
    assert len(result.data) == 0


def test_duckdb_upsert_insert(tmp_path):
    """Test upsert operation that inserts a new row."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Upsert (should insert)
    result = client.table("story_settings").upsert(
        {"story": "test", "data": '{"setting": 1}'},
        on_conflict="story"
    ).execute()

    assert len(result.data) == 1
    assert result.data[0]["story"] == "test"

    # Verify inserted
    result = client.table("story_settings").select("*").eq("story", "test").execute()
    assert len(result.data) == 1
    assert result.data[0]["data"] == '{"setting": 1}'


def test_duckdb_upsert_update(tmp_path):
    """Test upsert operation that updates an existing row."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Initial insert
    client.table("story_settings").upsert(
        {"story": "test", "data": '{"setting": 1}'},
        on_conflict="story"
    ).execute()

    # Upsert (should update)
    result = client.table("story_settings").upsert(
        {"story": "test", "data": '{"setting": 2}'},
        on_conflict="story"
    ).execute()

    # Verify only one row exists with updated value
    result = client.table("story_settings").select("*").eq("story", "test").execute()
    assert len(result.data) == 1
    assert result.data[0]["data"] == '{"setting": 2}'


def test_duckdb_multiple_filters(tmp_path):
    """Test query with multiple filters."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Insert multiple rows
    client.table("snippets").insert([
        {
            "id": "test-1",
            "story": "Story A",
            "parent_id": "parent-1",
            "child_id": None,
            "kind": "user",
            "content": "Content 1",
        },
        {
            "id": "test-2",
            "story": "Story A",
            "parent_id": "parent-2",
            "child_id": None,
            "kind": "user",
            "content": "Content 2",
        },
        {
            "id": "test-3",
            "story": "Story B",
            "parent_id": "parent-1",
            "child_id": None,
            "kind": "user",
            "content": "Content 3",
        },
    ]).execute()

    # Query with multiple filters
    result = client.table("snippets").select("*").eq("story", "Story A").eq("parent_id", "parent-1").execute()
    assert len(result.data) == 1
    assert result.data[0]["id"] == "test-1"


def test_duckdb_order_and_limit(tmp_path):
    """Test ordering and limiting results."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Insert multiple rows
    client.table("snippets").insert([
        {"id": "test-1", "story": "Story A", "parent_id": None, "child_id": None, "kind": "user", "content": "A"},
        {"id": "test-2", "story": "Story A", "parent_id": None, "child_id": None, "kind": "user", "content": "B"},
        {"id": "test-3", "story": "Story A", "parent_id": None, "child_id": None, "kind": "user", "content": "C"},
    ]).execute()

    # Test order and limit
    result = client.table("snippets").select("*").eq("story", "Story A").order("id", desc=True).limit(2).execute()
    assert len(result.data) == 2
    assert result.data[0]["id"] == "test-3"
    assert result.data[1]["id"] == "test-2"


def test_duckdb_list_insertion(tmp_path):
    """Test inserting multiple rows at once."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Insert multiple rows
    result = client.table("snippets").insert([
        {"id": "test-1", "story": "Story A", "parent_id": None, "child_id": None, "kind": "user", "content": "A"},
        {"id": "test-2", "story": "Story A", "parent_id": None, "child_id": None, "kind": "user", "content": "B"},
        {"id": "test-3", "story": "Story A", "parent_id": None, "child_id": None, "kind": "user", "content": "C"},
    ]).execute()

    assert len(result.data) == 3

    # Verify all rows were inserted
    result = client.table("snippets").select("*").eq("story", "Story A").execute()
    assert len(result.data) == 3


def test_duckdb_branches_composite_key(tmp_path):
    """Test operations on branches table with composite primary key."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Insert a branch
    result = client.table("branches").insert({
        "story": "Story A",
        "name": "main",
        "head_id": "snippet-1",
    }).execute()

    assert len(result.data) == 1
    assert result.data[0]["story"] == "Story A"
    assert result.data[0]["name"] == "main"

    # Upsert on composite key
    result = client.table("branches").upsert(
        {"story": "Story A", "name": "main", "head_id": "snippet-2"},
        on_conflict="story,name"
    ).execute()

    # Verify updated
    result = client.table("branches").select("*").eq("story", "Story A").eq("name", "main").execute()
    assert len(result.data) == 1
    assert result.data[0]["head_id"] == "snippet-2"


def test_duckdb_created_at_auto_populated(tmp_path):
    """Test that created_at is automatically populated."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Insert without created_at
    result = client.table("snippets").insert({
        "id": "test-1",
        "story": "Story A",
        "parent_id": None,
        "child_id": None,
        "kind": "user",
        "content": "Test",
    }).execute()

    assert "created_at" in result.data[0]
    assert result.data[0]["created_at"] is not None


def test_duckdb_persistence_across_connections(tmp_path):
    """Test that data persists across different client instances."""
    db_path = tmp_path / "test.duckdb"

    # Create first client and insert data
    client1 = DuckDBSupabaseClient(db_path=str(db_path))
    client1.table("snippets").insert({
        "id": "test-1",
        "story": "Story A",
        "parent_id": None,
        "child_id": None,
        "kind": "user",
        "content": "Persistent data",
    }).execute()

    # Create second client and verify data exists
    client2 = DuckDBSupabaseClient(db_path=str(db_path))
    result = client2.table("snippets").select("*").eq("id", "test-1").execute()
    assert len(result.data) == 1
    assert result.data[0]["content"] == "Persistent data"


def test_duckdb_lorebook_table(tmp_path):
    """Test operations on lorebook table."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Insert lore entry
    result = client.table("lorebook").insert({
        "id": "lore-1",
        "story": "Story A",
        "name": "Character Name",
        "kind": "character",
        "summary": "A brave hero",
        "tags": '["hero", "brave"]',
        "keys": '["hero", "protagonist"]',
        "always_on": True,
    }).execute()

    assert len(result.data) == 1
    assert result.data[0]["name"] == "Character Name"

    # Query lore entries
    result = client.table("lorebook").select("*").eq("story", "Story A").execute()
    assert len(result.data) == 1
    assert result.data[0]["always_on"] is True


def test_duckdb_app_state_table(tmp_path):
    """Test operations on app_state table."""
    db_path = tmp_path / "test.duckdb"
    client = DuckDBSupabaseClient(db_path=str(db_path))

    # Set state
    client.table("app_state").upsert(
        {"key": "current_story", "value": '"Story A"'},
        on_conflict="key"
    ).execute()

    # Get state
    result = client.table("app_state").select("*").eq("key", "current_story").execute()
    assert len(result.data) == 1
    assert result.data[0]["value"] == '"Story A"'

    # Update state
    client.table("app_state").upsert(
        {"key": "current_story", "value": '"Story B"'},
        on_conflict="key"
    ).execute()

    # Verify update
    result = client.table("app_state").select("*").eq("key", "current_story").execute()
    assert len(result.data) == 1
    assert result.data[0]["value"] == '"Story B"'
