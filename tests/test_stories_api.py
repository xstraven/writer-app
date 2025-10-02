from __future__ import annotations


def test_story_crud_and_duplication_flow(client):
    story = "Original Story"
    duplicate_name = "Duplicated Story"

    initial = client.get("/api/stories")
    assert initial.status_code == 200
    assert story not in initial.json()

    root = client.post(
        "/api/snippets/append",
        json={"story": story, "content": "Root scene", "kind": "user", "parent_id": None},
    ).json()
    client.post(
        "/api/snippets/append",
        json={"story": story, "content": "AI reply", "kind": "ai", "parent_id": root["id"]},
    )

    settings_payload = {
        "story": story,
        "temperature": 0.6,
        "max_tokens": 200,
        "model": "openrouter/test",
        "system_prompt": "Keep it grounded.",
        "context": {
            "summary": "The hero bargains with a shadow broker.",
            "npcs": [{"label": "Shadow Broker", "detail": "Deals in secrets."}],
            "objects": [{"label": "Ledger", "detail": "Filled with incriminating names."}],
        },
        "synopsis": "A spy navigates a web of intrigue.",
        "memory": {
            "characters": [{"type": "character", "label": "Hero", "detail": "Undercover agent."}],
            "subplots": [],
            "facts": [],
        },
        "gallery": ["https://example.com/spy.jpg"],
    }
    put_settings = client.put("/api/story-settings", json=settings_payload)
    assert put_settings.status_code == 200
    assert put_settings.json()["ok"] is True

    lore_payload = {
        "story": story,
        "name": "Mirror Shade",
        "kind": "faction",
        "summary": "A syndicate that trades in rumors.",
        "tags": ["spy"],
        "keys": ["shadow"],
        "always_on": True,
    }
    lore_response = client.post("/api/lorebook", json=lore_payload)
    assert lore_response.status_code == 200
    original_lore = lore_response.json()

    stories_after_seed = client.get("/api/stories")
    assert stories_after_seed.status_code == 200
    assert story in stories_after_seed.json()

    duplicate_response = client.post(
        "/api/stories/duplicate",
        json={"source": story, "target": duplicate_name, "mode": "all"},
    )
    assert duplicate_response.status_code == 200
    assert duplicate_response.json() == {"ok": True, "story": duplicate_name}

    original_path = client.get("/api/snippets/path", params={"story": story}).json()
    duplicate_path = client.get("/api/snippets/path", params={"story": duplicate_name}).json()
    assert [p["content"] for p in duplicate_path["path"]] == [
        p["content"] for p in original_path["path"]
    ]
    assert duplicate_path["text"] == original_path["text"]

    duplicate_settings = client.get("/api/story-settings", params={"story": duplicate_name}).json()
    assert duplicate_settings["synopsis"] == settings_payload["synopsis"]
    assert duplicate_settings["context"]["summary"] == settings_payload["context"]["summary"]
    assert duplicate_settings["gallery"] == settings_payload["gallery"]

    duplicate_lore = client.get("/api/lorebook", params={"story": duplicate_name}).json()
    assert len(duplicate_lore) == 1
    assert duplicate_lore[0]["name"] == original_lore["name"]

    delete_response = client.delete(f"/api/stories/{story}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"ok": True}

    cleared_path = client.get("/api/snippets/path", params={"story": story}).json()
    assert cleared_path["path"] == []
    assert cleared_path["text"] == ""

    cleared_lore = client.get("/api/lorebook", params={"story": story}).json()
    assert cleared_lore == []

    stories_after_delete = client.get("/api/stories").json()
    assert duplicate_name in stories_after_delete
    assert story not in stories_after_delete
