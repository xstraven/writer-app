from __future__ import annotations

from .config import get_settings
from .lorebook_store import LorebookStore
from .state_store import StateStore
from .base_settings_store import BaseSettingsStore
from .snippet_store import SnippetStore
from .story_settings_store import StorySettingsStore


# Global runtime singletons for stores and settings
settings = get_settings()
lorebook_store = LorebookStore()
state_store = StateStore()
snippet_store = SnippetStore()
base_settings_store = BaseSettingsStore()
story_settings_store = StorySettingsStore()

