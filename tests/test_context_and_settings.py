from __future__ import annotations

from storycraft.app.memory import CONTEXT_SUGGEST_SYSTEM


def test_suggest_context_returns_structured_payload(client):
    response = client.post(
        "/api/suggest-context",
        json={"current_text": "The hero studies the battlefield.", "model": None},
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"summary", "npcs", "objects", "system_prompt"}
    assert isinstance(data["summary"], str)
    assert isinstance(data["npcs"], list)
    assert isinstance(data["objects"], list)
    assert data["system_prompt"] == CONTEXT_SUGGEST_SYSTEM


def test_story_settings_persist_and_patch(client):
    story = "Context Story"
    payload = {
        "story": story,
        "temperature": 0.55,
        "max_tokens": 333,
        "model": "openrouter/test-model",
        "system_prompt": "Be helpful",
        "max_context_window": 900,
        "context": {
            "summary": "A tense parley in the throne room.",
            "npcs": [{"label": "Queen Mira", "detail": "Wary yet resolute."}],
            "objects": [{"label": "Silver Dagger", "detail": "An heirloom with hidden runes."}],
        },
        "synopsis": "The court debates war versus diplomacy.",
        "memory": {
            "characters": [{"type": "character", "label": "Captain Rhea", "detail": "Sworn to the queen."}],
            "subplots": [],
            "facts": [{"type": "fact", "label": "Siege", "detail": "Enemy forces approach."}],
        },
        "gallery": ["https://example.com/a.jpg"],
    }

    put_response = client.put("/api/story-settings", json=payload)
    assert put_response.status_code == 200
    put_data = put_response.json()
    assert put_data["ok"] is True
    assert put_data["story"] == story
    assert sorted(put_data["updated_keys"]) == [
        "context",
        "gallery",
        "max_context_window",
        "max_tokens",
        "memory",
        "model",
        "synopsis",
        "system_prompt",
        "temperature",
    ]

    get_response = client.get("/api/story-settings", params={"story": story})
    assert get_response.status_code == 200
    settings = get_response.json()
    assert settings["story"] == story
    assert settings["context"]["summary"] == payload["context"]["summary"]
    assert settings["synopsis"] == payload["synopsis"]
    assert settings["memory"]["characters"][0]["label"] == "Captain Rhea"
    assert settings["gallery"] == payload["gallery"]

    patch_payload = {
        "story": story,
        "synopsis": "Diplomacy prevails, but trust is fragile.",
        "gallery": ["https://example.com/a.jpg", "https://example.com/b.png"],
        "memory": {
            "characters": [
                {"type": "character", "label": "Queen Mira", "detail": "Now wary of betrayal."}
            ],
            "subplots": [],
            "facts": [],
        },
    }
    patch_response = client.put("/api/story-settings", json=patch_payload)
    assert patch_response.status_code == 200
    patch_data = patch_response.json()
    assert patch_data["ok"] is True
    assert set(patch_data["updated_keys"]) == {"synopsis", "gallery", "memory"}

    final_response = client.get("/api/story-settings", params={"story": story})
    assert final_response.status_code == 200
    final = final_response.json()
    assert final["synopsis"] == patch_payload["synopsis"]
    assert final["gallery"] == patch_payload["gallery"]
    assert final["memory"]["characters"][0]["label"] == "Queen Mira"
    assert final["context"]["summary"] == payload["context"]["summary"]
