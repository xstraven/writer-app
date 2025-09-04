from __future__ import annotations

from pathlib import Path

from storycraft.app.main import app as fastapi_app
from storycraft.app import main as main_mod
from storycraft.app.snippet_store import SnippetStore
from storycraft.app.lorebook_store import LorebookStore


def test_prompt_preview_default_prompt_order(tmp_path):
    # Use temp stores to avoid touching real data
    main_mod.snippet_store = SnippetStore(path=tmp_path / "pp_story.duckdb")
    main_mod.store = LorebookStore(path=tmp_path / "pp_lore.json")

    from fastapi.testclient import TestClient

    client = TestClient(fastapi_app)
    # No instruction provided, should inject default [Prompt] at the end
    payload = {
        "draft_text": "A short draft.",
        "instruction": "",
        "use_memory": False,
        "use_context": False,
        "story": None,
        "lore_ids": [],
        "system_prompt": None,
    }
    r = client.post("/api/prompt-preview", json=payload)
    assert r.status_code == 200
    data = r.json()
    msgs = data.get("messages", [])
    # Should contain at least system + story + meta
    assert len(msgs) >= 2
    # Last user message should contain [Prompt] with default text
    last = msgs[-1]
    assert last["role"] == "user"
    assert "[Prompt]" in last["content"]
    assert "Continue the story" in last["content"]


def test_continue_returns_stub_and_persists_when_story_given(tmp_path):
    # Attach temporary stores
    main_mod.snippet_store = SnippetStore(path=tmp_path / "cont_story.duckdb")
    main_mod.store = LorebookStore(path=tmp_path / "cont_lore.json")

    from fastapi.testclient import TestClient

    client = TestClient(fastapi_app)

    story = "Unit Test Story"
    payload = {
        "draft_text": "Anna-Lena stood by the door.",
        "instruction": "",
        "max_tokens": 128,
        "temperature": 0.3,
        "model": None,
        "use_memory": False,
        "use_context": False,
        "story": story,
        "system_prompt": None,
        "lore_ids": [],
    }
    r = client.post("/api/continue", json=payload)
    assert r.status_code == 200
    data = r.json()
    # Continuation should be a non-empty string (stubbed or real)
    assert isinstance(data.get("continuation"), str)
    assert data.get("continuation")

    # Verify snippets path now contains at least root + continuation
    r2 = client.get("/api/snippets/path", params={"story": story})
    assert r2.status_code == 200
    p = r2.json()
    path = p.get("path", [])
    assert len(path) >= 1


def test_seed_and_continue_test_story_1(tmp_path):
    # Point stores at temp files so seeding reads samples but writes into tmp DB/JSON
    main_mod.snippet_store = SnippetStore(path=tmp_path / "seed_story.duckdb")
    main_mod.store = LorebookStore(path=tmp_path / "seed_lore.json")

    from fastapi.testclient import TestClient

    client = TestClient(fastapi_app)

    # Seed using default filenames derived from story slug
    r = client.post("/api/dev/seed", json={"story": "Test Story 1", "purge": True})
    assert r.status_code == 200
    stats = r.json()
    # Expect to import both chunks and lore from repo samples
    assert stats.get("chunks_imported", 0) > 0
    assert stats.get("lore_imported", 0) > 0

    # Continue from the seeded story's branch using stub LLM
    r2 = client.post(
        "/api/continue",
        json={
            "draft_text": "",  # rely on history_text from snippets
            "instruction": "",
            "max_tokens": 64,
            "temperature": 0.2,
            "use_memory": False,
            "use_context": False,
            "story": "Test Story 1",
        },
    )
    assert r2.status_code == 200
    cont = r2.json()
    assert isinstance(cont.get("continuation"), str)
    assert cont.get("continuation")
