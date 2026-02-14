"""Initial Storycraft campaign schema.

Revision ID: 20260214_0001
Revises:
Create Date: 2026-02-14 13:05:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260214_0001"
down_revision = None
branch_labels = None
depends_on = None


UTC_NOW = sa.text("timezone('utc', now())")


def upgrade() -> None:
    op.create_table(
        "campaigns",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("world_setting", sa.Text(), nullable=False),
        sa.Column("game_system", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("invite_code", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="lobby"),
        sa.Column("current_turn_player_id", sa.Text(), nullable=True),
        sa.Column("turn_order", sa.Text(), nullable=True),
        sa.Column("turn_number", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("language", sa.Text(), nullable=False, server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=UTC_NOW),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=UTC_NOW),
        sa.PrimaryKeyConstraint("id", name="pk_campaigns"),
        sa.UniqueConstraint("invite_code", name="uq_campaigns_invite_code"),
    )
    op.create_index("ix_campaigns_created_by", "campaigns", ["created_by"], unique=False)
    op.create_index("ix_campaigns_updated_at", "campaigns", ["updated_at"], unique=False)

    op.create_table(
        "players",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("campaign_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("session_token", sa.Text(), nullable=True),
        sa.Column("character_sheet", sa.Text(), nullable=True),
        sa.Column("is_gm", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("turn_position", sa.Integer(), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=UTC_NOW),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["campaign_id"],
            ["campaigns.id"],
            name="fk_players_campaign_id_campaigns",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_players"),
    )
    op.create_index("ix_players_campaign_id", "players", ["campaign_id"], unique=False)
    op.create_index("ix_players_session_token", "players", ["session_token"], unique=False)
    op.create_index(
        "ix_players_campaign_turn_position",
        "players",
        ["campaign_id", "turn_position"],
        unique=False,
    )
    op.create_index(
        "ix_players_session_campaign",
        "players",
        ["session_token", "campaign_id"],
        unique=False,
    )

    op.create_table(
        "campaign_actions",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("campaign_id", sa.Text(), nullable=False),
        sa.Column("player_id", sa.Text(), nullable=True),
        sa.Column("action_type", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("action_results", sa.Text(), nullable=True),
        sa.Column("turn_number", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=UTC_NOW),
        sa.ForeignKeyConstraint(
            ["campaign_id"],
            ["campaigns.id"],
            name="fk_campaign_actions_campaign_id_campaigns",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["player_id"],
            ["players.id"],
            name="fk_campaign_actions_player_id_players",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_campaign_actions"),
    )
    op.create_index(
        "ix_campaign_actions_campaign_id",
        "campaign_actions",
        ["campaign_id"],
        unique=False,
    )
    op.create_index(
        "ix_campaign_actions_campaign_created_at",
        "campaign_actions",
        ["campaign_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_campaign_actions_campaign_turn_created_at",
        "campaign_actions",
        ["campaign_id", "turn_number", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_campaign_actions_campaign_turn_created_at", table_name="campaign_actions")
    op.drop_index("ix_campaign_actions_campaign_created_at", table_name="campaign_actions")
    op.drop_index("ix_campaign_actions_campaign_id", table_name="campaign_actions")
    op.drop_table("campaign_actions")

    op.drop_index("ix_players_session_campaign", table_name="players")
    op.drop_index("ix_players_campaign_turn_position", table_name="players")
    op.drop_index("ix_players_session_token", table_name="players")
    op.drop_index("ix_players_campaign_id", table_name="players")
    op.drop_table("players")

    op.drop_index("ix_campaigns_updated_at", table_name="campaigns")
    op.drop_index("ix_campaigns_created_by", table_name="campaigns")
    op.drop_table("campaigns")
