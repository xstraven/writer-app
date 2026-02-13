from __future__ import annotations

from . import runtime
from .campaign_action_store import CampaignActionStore
from .campaign_store import CampaignStore
from .player_store import PlayerStore


def get_campaign_store() -> CampaignStore:
    return runtime.campaign_store


def get_player_store() -> PlayerStore:
    return runtime.player_store


def get_campaign_action_store() -> CampaignActionStore:
    return runtime.campaign_action_store
