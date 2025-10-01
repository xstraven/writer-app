from fastapi.testclient import TestClient

from storycraft.app.main import app
from storycraft.app import runtime as runtime_mod


def test_snippets_api_flow(tmp_path, monkeypatch):
    # Point the SnippetStore at a temp DB by monkeypatching the instance on the app module.
    from storycraft.app import main as main_mod
    from storycraft.app.snippet_store import SnippetStore

    runtime_mod.snippet_store = SnippetStore(path=tmp_path / "api_story.duckdb")
    main_mod.snippet_store = runtime_mod.snippet_store

    story = "API Story"
    with TestClient(app) as client:
        # No path yet
        r = client.get("/api/snippets/path", params={"story": story})
        assert r.status_code == 200
        assert r.json()["path"] == []

        # Append root
        r = client.post(
            "/api/snippets/append",
            json={"story": story, "content": "Root", "kind": "user", "parent_id": None},
        )
        assert r.status_code == 200
        root = r.json()

        # Append child B
        r = client.post(
            "/api/snippets/append",
            json={"story": story, "content": "B", "kind": "ai", "parent_id": root["id"]},
        )
        assert r.status_code == 200
        b = r.json()

        # Regenerate alternative C (inactive)
        r = client.post(
            "/api/snippets/regenerate",
            json={
                "story": story,
                "target_snippet_id": b["id"],
                "content": "C",
                "kind": "ai",
                "set_active": False,
            },
        )
        assert r.status_code == 200
        c = r.json()

        # Choose C
        r = client.post(
            "/api/snippets/choose-active",
            json={"story": story, "parent_id": root["id"], "child_id": c["id"]},
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Path should be Root -> C
        r = client.get("/api/snippets/path", params={"story": story})
        data = r.json()
        assert [p["content"] for p in data["path"]] == ["Root", "C"]
    assert data["text"] == "Root\n\nC"


def test_update_snippet_content(tmp_path, monkeypatch):
    from storycraft.app import main as main_mod
    from storycraft.app.snippet_store import SnippetStore
    from fastapi.testclient import TestClient

    runtime_mod.snippet_store = SnippetStore(path=tmp_path / "api_edit.duckdb")
    main_mod.snippet_store = runtime_mod.snippet_store
    story = "Edit Story"
    client = TestClient(main_mod.app)

    # Create root and a child
    r = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "A", "kind": "user", "parent_id": None},
    )
    root = r.json()
    r = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "B", "kind": "ai", "parent_id": root["id"]},
    )
    _ = r.json()

    # Edit root
    r = client.put(f"/api/snippets/{root['id']}", json={"content": "A1"})
    assert r.status_code == 200

    # Path should use updated content
    r = client.get("/api/snippets/path", params={"story": story})
    data = r.json()
    assert [p["content"] for p in data["path"]] == ["A1", "B"]
    assert data["text"] == "A1\n\nB"


def test_insert_and_delete_endpoints(tmp_path, monkeypatch):
    from storycraft.app import main as main_mod
    from storycraft.app.snippet_store import SnippetStore
    from fastapi.testclient import TestClient

    runtime_mod.snippet_store = SnippetStore(path=tmp_path / "api_edit2.duckdb")
    main_mod.snippet_store = runtime_mod.snippet_store
    story = "Edit Story 2"
    client = TestClient(main_mod.app)

    # root -> B
    r = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "A", "kind": "user", "parent_id": None},
    )
    root = r.json()
    r = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "B", "kind": "ai", "parent_id": root["id"]},
    )
    b = r.json()
    # Insert above B
    r = client.post(
        "/api/snippets/insert-above",
        json={"story": story, "target_snippet_id": b["id"], "content": "ABOVE"},
    )
    assert r.status_code == 200
    # Insert below ABOVE
    above = r.json()
    r = client.post(
        "/api/snippets/insert-below",
        json={"story": story, "parent_snippet_id": above["id"], "content": "BELOW"},
    )
    assert r.status_code == 200
    # Delete leaf C (which is B now after below insert adds between)
    # Get current path and delete last
    r = client.get("/api/snippets/path", params={"story": story})
    head = r.json()
    last_id = head["path"][-1]["id"]
    r = client.delete(f"/api/snippets/{last_id}", params={"story": story})
    assert r.status_code == 200
