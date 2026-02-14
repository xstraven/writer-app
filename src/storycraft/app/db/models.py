from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Table,
    Text,
    text,
)

from .metadata import metadata

UTC_NOW = text("timezone('utc', now())")

campaigns = Table(
    "campaigns",
    metadata,
    Column("id", Text, primary_key=True),
    Column("name", Text, nullable=False),
    Column("description", Text, nullable=True),
    Column("world_setting", Text, nullable=False),
    Column("game_system", Text, nullable=True),
    Column("created_by", Text, nullable=False),
    Column("invite_code", Text, nullable=False, unique=True),
    Column("status", Text, nullable=False, server_default="lobby"),
    Column("current_turn_player_id", Text, nullable=True),
    Column("turn_order", Text, nullable=True),
    Column("turn_number", Integer, nullable=False, server_default="0"),
    Column("language", Text, nullable=False, server_default="en"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=UTC_NOW),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=UTC_NOW),
)

players = Table(
    "players",
    metadata,
    Column("id", Text, primary_key=True),
    Column("campaign_id", Text, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
    Column("name", Text, nullable=False),
    Column("session_token", Text, nullable=True),
    Column("character_sheet", Text, nullable=True),
    Column("is_gm", Boolean, nullable=False, server_default=text("false")),
    Column("turn_position", Integer, nullable=True),
    Column("joined_at", DateTime(timezone=True), nullable=False, server_default=UTC_NOW),
    Column("last_active_at", DateTime(timezone=True), nullable=True),
)

campaign_actions = Table(
    "campaign_actions",
    metadata,
    Column("id", Text, primary_key=True),
    Column("campaign_id", Text, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
    Column("player_id", Text, ForeignKey("players.id", ondelete="SET NULL"), nullable=True),
    Column("action_type", Text, nullable=False),
    Column("content", Text, nullable=False),
    Column("action_results", Text, nullable=True),
    Column("turn_number", Integer, nullable=False, server_default="0"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=UTC_NOW),
)

Index("ix_campaigns_created_by", campaigns.c.created_by)
Index("ix_campaigns_updated_at", campaigns.c.updated_at)
Index("ix_players_campaign_id", players.c.campaign_id)
Index("ix_players_session_token", players.c.session_token)
Index("ix_players_campaign_turn_position", players.c.campaign_id, players.c.turn_position)
Index("ix_players_session_campaign", players.c.session_token, players.c.campaign_id)
Index("ix_campaign_actions_campaign_id", campaign_actions.c.campaign_id)
Index(
    "ix_campaign_actions_campaign_created_at",
    campaign_actions.c.campaign_id,
    campaign_actions.c.created_at,
)
Index(
    "ix_campaign_actions_campaign_turn_created_at",
    campaign_actions.c.campaign_id,
    campaign_actions.c.turn_number,
    campaign_actions.c.created_at,
)

