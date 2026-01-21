from __future__ import annotations

from .config import get_settings
from .lorebook_store import LorebookStore
from .state_store import StateStore
from .base_settings_store import BaseSettingsStore
from .snippet_store import SnippetStore
from .story_settings_store import StorySettingsStore
from .campaign_store import CampaignStore
from .player_store import PlayerStore
from .campaign_action_store import CampaignActionStore
from .services.supabase_client import get_supabase_client


# Global runtime singletons for stores and settings
settings = get_settings()
supabase_client = get_supabase_client()

lorebook_store = LorebookStore(client=supabase_client)
state_store = StateStore(client=supabase_client)
snippet_store = SnippetStore(client=supabase_client)
base_settings_store = BaseSettingsStore()
story_settings_store = StorySettingsStore(client=supabase_client)

# Campaign stores for group RPG
campaign_store = CampaignStore(client=supabase_client)
player_store = PlayerStore(client=supabase_client)
campaign_action_store = CampaignActionStore(client=supabase_client)
