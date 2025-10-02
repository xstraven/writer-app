from __future__ import annotations


def test_story_settings_roundtrip(client):
    story = "Settings Story"

    response = client.get("/api/story-settings", params={"story": story})
    assert response.status_code == 200
    data = response.json()
    assert data["story"] == story
    assert "gallery" in data

    payload = {
        "story": story,
        "temperature": 0.55,
        "max_tokens": 333,
        "model": "openrouter/test-model",
        "system_prompt": "Be helpful",
        "max_context_window": 900,
        "context": {"summary": "scene", "npcs": [], "objects": []},
        "synopsis": "test synopsis",
        "memory": {"characters": [], "subplots": [], "facts": []},
        "gallery": ["https://example.com/a.jpg"],
    }
    r = client.put("/api/story-settings", json=payload)
    assert r.status_code == 200
    assert r.json()["ok"] is True

    r2 = client.get("/api/story-settings", params={"story": story})
    assert r2.status_code == 200
    s = r2.json()
    for k in [
        "temperature",
        "max_tokens",
        "model",
        "system_prompt",
        "max_context_window",
        "synopsis",
        "gallery",
    ]:
        assert s.get(k) == payload[k]
    assert s["context"]["summary"] == "scene"


def test_story_settings_lorebook_replace(client):
    story = "Lore Replace"

    r = client.post(
        "/api/lorebook",
        json={
            "story": story,
            "name": "Alpha",
            "kind": "character",
            "summary": "A",
            "tags": ["t"],
            "keys": ["k"],
            "always_on": True,
        },
    )
    assert r.status_code == 200
    r = client.post(
        "/api/lorebook",
        json={
            "story": story,
            "name": "Beta",
            "kind": "place",
            "summary": "B",
            "tags": [],
            "keys": [],
            "always_on": False,
        },
    )
    assert r.status_code == 200

    new_lore = [
        {
            "story": story,
            "name": "Gamma",
            "kind": "item",
            "summary": "G",
            "tags": ["x"],
            "keys": [],
            "always_on": False,
        }
    ]
    r = client.put(
        "/api/story-settings",
        json={"story": story, "lorebook": new_lore},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True

    r = client.get("/api/lorebook", params={"story": story})
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["name"] == "Gamma"
