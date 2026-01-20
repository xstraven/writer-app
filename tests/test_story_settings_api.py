from __future__ import annotations

from pathlib import PurePosixPath

from storycraft.app.routes import story_settings as story_settings_routes


def _gallery_values(gallery):
    return [item["value"] if isinstance(item, dict) else item for item in (gallery or [])]


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
    ]:
        assert s.get(k) == payload[k]
    assert _gallery_values(s.get("gallery")) == payload["gallery"]
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


def test_story_settings_gallery_upload_and_delete(monkeypatch, client, tmp_path):
    images_dir = tmp_path / "images"
    monkeypatch.setattr(story_settings_routes, "IMAGES_DIR", images_dir)

    story = "../../evil story"
    files = {"file": ("test.html", b"fake", "image/png")}
    response = client.post(
        "/api/story-settings/upload-image",
        data={"story": story},
        files=files,
    )
    assert response.status_code == 200
    payload = response.json()
    url_path = PurePosixPath(payload["url"])
    safe_dir = url_path.parts[-2]
    filename = url_path.name
    file_path = images_dir / safe_dir / filename

    assert filename.endswith(".png")
    assert file_path.exists()

    delete_response = client.delete(
        "/api/story-settings/delete-image",
        params={"story": story, "filename": filename},
    )
    assert delete_response.status_code == 200
    assert not file_path.exists()

    bad_delete = client.delete(
        "/api/story-settings/delete-image",
        params={"story": story, "filename": "../escape.png"},
    )
    assert bad_delete.status_code == 400
