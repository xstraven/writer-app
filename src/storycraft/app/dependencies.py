from __future__ import annotations

from . import runtime
from .base_settings_store import BaseSettingsStore
from .campaign_action_store import CampaignActionStore
from .campaign_store import CampaignStore
from .lorebook_store import LorebookStore
from .player_store import PlayerStore
from .snippet_store import SnippetStore
from .state_store import StateStore
from .story_settings_store import StorySettingsStore


def get_snippet_store() -> SnippetStore:
    return runtime.snippet_store


def get_lorebook_store() -> LorebookStore:
    return runtime.lorebook_store


def get_story_settings_store() -> StorySettingsStore:
    return runtime.story_settings_store


def get_base_settings_store() -> BaseSettingsStore:
    return runtime.base_settings_store


def get_state_store() -> StateStore:
    return runtime.state_store


def get_campaign_store() -> CampaignStore:
    return runtime.campaign_store


def get_player_store() -> PlayerStore:
    return runtime.player_store


def get_campaign_action_store() -> CampaignActionStore:
    return runtime.campaign_action_store
