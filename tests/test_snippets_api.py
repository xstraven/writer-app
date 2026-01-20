from __future__ import annotations


def test_snippets_api_flow(client):
    story = "API Story"

    r = client.get("/api/snippets/path", params={"story": story})
    assert r.status_code == 200
    assert r.json()["path"] == []

    r = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "Root", "kind": "user", "parent_id": None},
    )
    assert r.status_code == 200
    root = r.json()
    assert root["story"] == story
    assert root["content"] == "Root"

    r = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "B", "kind": "ai", "parent_id": root["id"]},
    )
    assert r.status_code == 200
    child = r.json()
    assert child["parent_id"] == root["id"]

    r = client.post(
        "/api/snippets/regenerate",
        json={
            "story": story,
            "target_snippet_id": child["id"],
            "content": "C",
            "kind": "ai",
            "set_active": False,
        },
    )
    assert r.status_code == 200
    alt = r.json()
    assert alt["content"] == "C"

    r = client.post(
        "/api/snippets/choose-active",
        json={"story": story, "parent_id": root["id"], "child_id": alt["id"]},
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    r = client.get("/api/snippets/path", params={"story": story})
    data = r.json()
    assert [p["content"] for p in data["path"]] == ["Root", "C"]
    assert data["text"] == "Root\n\nC"


def test_update_and_delete_snippet(client):
    story = "Edit Story"

    root = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "A", "kind": "user", "parent_id": None},
    ).json()
    child = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "B", "kind": "ai", "parent_id": root["id"]},
    ).json()

    r = client.put(f"/api/snippets/{root['id']}", json={"content": "A1"})
    assert r.status_code == 200
    assert r.json()["content"] == "A1"

    path = client.get("/api/snippets/path", params={"story": story}).json()
    assert [p["content"] for p in path["path"]] == ["A1", "B"]

    r = client.delete(f"/api/snippets/{child['id']}", params={"story": story})
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    path_after = client.get("/api/snippets/path", params={"story": story}).json()
    assert len(path_after["path"]) == 1
    assert path_after["path"][0]["content"] == "A1"
    assert path_after["head_id"] == path_after["path"][0]["id"]

    manual_path = client.get(
        "/api/snippets/path", params={"story": story, "head_id": root["id"]}
    ).json()
    assert [p["content"] for p in manual_path["path"]] == ["A1"]
    assert manual_path["text"] == "A1"


def test_delete_snippet_validates_story(client):
    story = "Mismatch Story"
    root = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "Root", "kind": "user", "parent_id": None},
    ).json()

    response = client.delete(f"/api/snippets/{root['id']}", params={"story": "Other"})
    assert response.status_code == 400
    assert "different story" in response.json()["detail"]

    still_there = client.get("/api/snippets/path", params={"story": story}).json()
    assert still_there["path"][0]["id"] == root["id"]


def test_insert_above_below_validation(client):
    story = "Insert Story"
    root = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "Root", "kind": "user", "parent_id": None},
    ).json()
    child = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "Leaf", "kind": "ai", "parent_id": root["id"]},
    ).json()

    r = client.post(
        "/api/snippets/insert-above",
        json={"story": story, "target_snippet_id": child["id"], "content": "Above"},
    )
    assert r.status_code == 200
    above = r.json()
    assert above["content"] == "Above"

    r = client.post(
        "/api/snippets/insert-below",
        json={"story": story, "parent_snippet_id": above["id"], "content": "Below"},
    )
    assert r.status_code == 200
    below = r.json()
    assert below["parent_id"] == above["id"]

    fail_above = client.post(
        "/api/snippets/insert-above",
        json={"story": story, "target_snippet_id": "missing", "content": "X"},
    )
    assert fail_above.status_code == 404
    assert "not found" in fail_above.json()["detail"].lower()

    fail_below = client.post(
        "/api/snippets/insert-below",
        json={"story": story, "parent_snippet_id": "missing", "content": "Y"},
    )
    assert fail_below.status_code == 404
    assert "not found" in fail_below.json()["detail"].lower()


def test_branch_creation_and_deletion(client):
    story = "Branch Story"
    root = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "Root", "kind": "user", "parent_id": None},
    ).json()
    branch_head = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "Alt", "kind": "ai", "parent_id": root["id"]},
    ).json()

    create_branch = client.post(
        "/api/branches",
        json={"story": story, "name": "alt", "head_id": branch_head["id"]},
    )
    assert create_branch.status_code == 200
    assert create_branch.json() == {"ok": True}

    branches = client.get("/api/branches", params={"story": story}).json()
    names = {b["name"] for b in branches}
    assert {"main", "alt"}.issubset(names)

    delete_branch = client.delete(f"/api/branches/alt", params={"story": story})
    assert delete_branch.status_code == 200
    assert delete_branch.json() == {"ok": True}

    branches_after = client.get("/api/branches", params={"story": story}).json()
    names_after = {b["name"] for b in branches_after}
    assert "alt" not in names_after
