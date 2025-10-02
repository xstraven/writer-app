from __future__ import annotations

from collections.abc import Generator
from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

from storycraft.app import main as main_mod
from storycraft.app import runtime as runtime_mod
from storycraft.app.base_settings_store import BaseSettingsStore
from storycraft.app.lorebook_store import LorebookStore
from storycraft.app.main import app as fastapi_app
from storycraft.app.snippet_store import SnippetStore
from storycraft.app.story_settings_store import StorySettingsStore


@pytest.fixture
def isolated_stores(tmp_path) -> Generator[Dict[str, Any], None, None]:
    snippet = SnippetStore(path=tmp_path / "snippets.duckdb")
    lore = LorebookStore(path=tmp_path / "lore.json")
    story_settings = StorySettingsStore(path=tmp_path / "story_settings.duckdb")
    base_settings = BaseSettingsStore(path=tmp_path / "base_settings.duckdb")

    original = {
        "snippet": runtime_mod.snippet_store,
        "lore": runtime_mod.lorebook_store,
        "story_settings": runtime_mod.story_settings_store,
        "base_settings": runtime_mod.base_settings_store,
    }

    runtime_mod.snippet_store = snippet
    runtime_mod.lorebook_store = lore
    runtime_mod.story_settings_store = story_settings
    runtime_mod.base_settings_store = base_settings

    main_mod.snippet_store = snippet
    main_mod.lorebook_store = lore
    main_mod.story_settings_store = story_settings
    main_mod.base_settings_store = base_settings
    main_mod.store = lore

    try:
        yield {
            "snippet_store": snippet,
            "lorebook_store": lore,
            "story_settings_store": story_settings,
            "base_settings_store": base_settings,
        }
    finally:
        runtime_mod.snippet_store = original["snippet"]
        runtime_mod.lorebook_store = original["lore"]
        runtime_mod.story_settings_store = original["story_settings"]
        runtime_mod.base_settings_store = original["base_settings"]

        main_mod.snippet_store = original["snippet"]
        main_mod.lorebook_store = original["lore"]
        main_mod.story_settings_store = original["story_settings"]
        main_mod.base_settings_store = original["base_settings"]
        main_mod.store = original["lore"]


@pytest.fixture
def client(isolated_stores: Dict[str, Any]) -> Generator[TestClient, None, None]:
    with TestClient(fastapi_app) as test_client:
        yield test_client


@pytest.fixture
def snippet_store(isolated_stores: Dict[str, Any]) -> SnippetStore:
    return isolated_stores["snippet_store"]


@pytest.fixture
def lore_store(isolated_stores: Dict[str, Any]) -> LorebookStore:
    return isolated_stores["lorebook_store"]


@pytest.fixture
def story_settings_store(isolated_stores: Dict[str, Any]) -> StorySettingsStore:
    return isolated_stores["story_settings_store"]
