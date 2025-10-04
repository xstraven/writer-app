from __future__ import annotations

from storycraft.app import config as config_mod
from storycraft.app.models import LoreEntryCreate


def test_prompt_preview_default_prompt_order(client):
    payload = {
        "draft_text": "A short draft.",
        "instruction": "",
        "use_memory": False,
        "use_context": False,
        "story": None,
        "lore_ids": [],
        "system_prompt": None,
    }
    response = client.post("/api/prompt-preview", json=payload)
    assert response.status_code == 200
    data = response.json()
    messages = data["messages"]
    assert len(messages) >= 2
    last = messages[-1]
    assert last["role"] == "user"
    assert "[Prompt]" in last["content"]
    assert "Continue the story" in last["content"]


def test_prompt_preview_includes_context_details(client):
    payload = {
        "draft_text": "The courtyard buzzed with intrigue.",
        "use_memory": False,
        "use_context": True,
        "context": {
            "summary": "A tense meeting in the palace courtyard.",
            "npcs": [
                {"label": "Captain Rhea", "detail": "Head of the royal guard, fiercely loyal."}
            ],
            "objects": [
                {"label": "Sealed Scroll", "detail": "Contains secret orders from the queen."}
            ],
        },
    }
    response = client.post("/api/prompt-preview", json=payload)
    assert response.status_code == 200
    data = response.json()
    messages = data["messages"]
    assert messages and messages[-1]["role"] == "user"
    meta = messages[-1]["content"]
    assert "[Story Description]" in meta
    assert "palace courtyard" in meta
    assert "[Context]" in meta
    assert "Captain Rhea" in meta
    assert "Sealed Scroll" in meta


def test_continue_persists_snippets_when_preview_only_false(client):
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
        "preview_only": False,
    }
    response = client.post("/api/continue", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data.get("continuation"), str)
    assert data["continuation"]

    path_response = client.get("/api/snippets/path", params={"story": story})
    assert path_response.status_code == 200
    path_payload = path_response.json()
    path = path_payload["path"]
    assert len(path) == 2
    assert path[0]["kind"] == "user"
    assert path[0]["content"] == "Anna-Lena stood by the door."
    assert path[1]["kind"] == "ai"
    assert path[1]["content"] == data["continuation"]
    assert data["continuation"] in path_payload["text"]


def test_prompt_preview_auto_selects_lore(client, lore_store):
    story = "Lore Story"
    entry = lore_store.create(
        LoreEntryCreate(
            story=story,
            name="Ancient Wyrm",
            kind="creature",
            summary="An elder dragon that wakes when the wyrm-song plays.",
            tags=["dragon"],
            keys=["wyrm"],
            always_on=False,
        )
    )

    payload = {
        "draft_text": "The wyrm-song echoed through the caverns.",
        "instruction": "",
        "use_memory": False,
        "use_context": False,
        "story": story,
        "lore_ids": [],
        "system_prompt": None,
    }
    response = client.post("/api/prompt-preview", json=payload)
    assert response.status_code == 200
    meta = response.json()["messages"][-1]["content"]
    assert "[Lorebook]" in meta
    assert entry.name in meta
    assert "elder dragon" in meta.lower()


def test_continue_returns_stub_without_api_key(client, monkeypatch):
    monkeypatch.delenv("STORYCRAFT_OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("STORYCRAFT_OPENROUTER_API_KEY", "")
    config_mod.get_settings.cache_clear()

    payload = {
        "draft_text": "Testing stub behavior.",
        "instruction": "",
        "max_tokens": 16,
        "temperature": 0.1,
        "model": None,
        "use_memory": False,
        "use_context": False,
        "story": None,
        "preview_only": True,
    }
    response = client.post("/api/continue", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "[DEV MODE]" in data["continuation"]
    assert data["model"]

    config_mod.get_settings.cache_clear()
