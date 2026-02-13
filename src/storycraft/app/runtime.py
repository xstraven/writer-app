from __future__ import annotations

from .config import get_settings
from .campaign_store import CampaignStore
from .player_store import PlayerStore
from .campaign_action_store import CampaignActionStore
from .services.persistence_client import get_persistence_client


# Global runtime singletons for stores and settings
settings = get_settings()
persistence_client = get_persistence_client()

# Campaign stores for group RPG
campaign_store = CampaignStore(client=persistence_client)
player_store = PlayerStore(client=persistence_client)
campaign_action_store = CampaignActionStore(client=persistence_client)
