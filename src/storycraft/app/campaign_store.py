from __future__ import annotations

import json
import random
import string
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from supabase import Client

from .models import Campaign, GameSystem
from .services.supabase_client import get_supabase_client


def _generate_invite_code() -> str:
    """Generate a 6-character alphanumeric invite code."""
    chars = string.ascii_uppercase + string.digits
    # Remove ambiguous characters
    chars = chars.replace("0", "").replace("O", "").replace("I", "").replace("1", "")
    return "".join(random.choices(chars, k=6))


def _generate_id() -> str:
    """Generate a UUID for campaign ID."""
    return str(uuid.uuid4())


class CampaignStore:
    """Store for campaign CRUD operations."""

    def __init__(self, *, client: Client | None = None, table: str = "campaigns") -> None:
        self._client = client or get_supabase_client()
        self._table_name = table

    def _table(self):
        return self._client.table(self._table_name)

    def _row_to_campaign(self, row: dict) -> Campaign:
        """Convert a database row to a Campaign model."""
        game_system = None
        if row.get("game_system"):
            try:
                gs_data = json.loads(row["game_system"]) if isinstance(row["game_system"], str) else row["game_system"]
                game_system = GameSystem(**gs_data)
            except Exception:
                pass

        turn_order = []
        if row.get("turn_order"):
            try:
                turn_order = json.loads(row["turn_order"]) if isinstance(row["turn_order"], str) else row["turn_order"]
            except Exception:
                pass

        return Campaign(
            id=row["id"],
            name=row["name"],
            description=row.get("description") or "",
            world_setting=row["world_setting"],
            game_system=game_system,
            created_by=row["created_by"],
            invite_code=row["invite_code"],
            status=row.get("status") or "lobby",
            current_turn_player_id=row.get("current_turn_player_id"),
            turn_order=turn_order,
            turn_number=row.get("turn_number") or 0,
            created_at=row["created_at"] if isinstance(row["created_at"], datetime) else datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
            updated_at=row["updated_at"] if isinstance(row["updated_at"], datetime) else datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00")),
        )

    def create(
        self,
        name: str,
        world_setting: str,
        created_by: str,
        description: str = "",
        game_system: Optional[GameSystem] = None,
    ) -> Campaign:
        """Create a new campaign."""
        now = datetime.now(tz=timezone.utc)
        campaign_id = _generate_id()
        invite_code = _generate_invite_code()

        # Ensure invite code is unique
        while self.get_by_invite_code(invite_code) is not None:
            invite_code = _generate_invite_code()

        payload = {
            "id": campaign_id,
            "name": name,
            "description": description,
            "world_setting": world_setting,
            "game_system": json.dumps(game_system.model_dump()) if game_system else None,
            "created_by": created_by,
            "invite_code": invite_code,
            "status": "lobby",
            "current_turn_player_id": None,
            "turn_order": json.dumps([]),
            "turn_number": 0,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        self._table().insert(payload).execute()

        return Campaign(
            id=campaign_id,
            name=name,
            description=description,
            world_setting=world_setting,
            game_system=game_system,
            created_by=created_by,
            invite_code=invite_code,
            status="lobby",
            current_turn_player_id=None,
            turn_order=[],
            turn_number=0,
            created_at=now,
            updated_at=now,
        )

    def get(self, campaign_id: str) -> Optional[Campaign]:
        """Get a campaign by ID."""
        res = self._table().select("*").eq("id", campaign_id).limit(1).execute()
        rows = res.data or []
        if not rows:
            return None
        return self._row_to_campaign(rows[0])

    def get_by_invite_code(self, invite_code: str) -> Optional[Campaign]:
        """Get a campaign by invite code."""
        code = (invite_code or "").strip().upper()
        if not code:
            return None
        res = self._table().select("*").eq("invite_code", code).limit(1).execute()
        rows = res.data or []
        if not rows:
            return None
        return self._row_to_campaign(rows[0])

    def list_by_player(self, player_id: str) -> List[Campaign]:
        """List all campaigns a player is part of (via players table join)."""
        # This requires a join with players table - we'll do it in the route
        # For now, return all campaigns created by this player
        res = self._table().select("*").eq("created_by", player_id).order("updated_at", desc=True).execute()
        return [self._row_to_campaign(row) for row in (res.data or [])]

    def update(
        self,
        campaign_id: str,
        *,
        name: Optional[str] = None,
        description: Optional[str] = None,
        game_system: Optional[GameSystem] = None,
        status: Optional[str] = None,
        current_turn_player_id: Optional[str] = None,
        turn_order: Optional[List[str]] = None,
        turn_number: Optional[int] = None,
    ) -> Optional[Campaign]:
        """Update a campaign."""
        updates = {"updated_at": datetime.now(tz=timezone.utc).isoformat()}

        if name is not None:
            updates["name"] = name
        if description is not None:
            updates["description"] = description
        if game_system is not None:
            updates["game_system"] = json.dumps(game_system.model_dump())
        if status is not None:
            updates["status"] = status
        if current_turn_player_id is not None:
            updates["current_turn_player_id"] = current_turn_player_id
        if turn_order is not None:
            updates["turn_order"] = json.dumps(turn_order)
        if turn_number is not None:
            updates["turn_number"] = turn_number

        self._table().update(updates).eq("id", campaign_id).execute()
        return self.get(campaign_id)

    def set_turn(self, campaign_id: str, player_id: str, turn_number: int) -> Optional[Campaign]:
        """Set the current turn player and number."""
        return self.update(
            campaign_id,
            current_turn_player_id=player_id,
            turn_number=turn_number,
        )

    def advance_turn(self, campaign_id: str) -> Optional[Campaign]:
        """Advance to the next player's turn."""
        campaign = self.get(campaign_id)
        if not campaign or not campaign.turn_order:
            return campaign

        current_idx = 0
        if campaign.current_turn_player_id in campaign.turn_order:
            current_idx = campaign.turn_order.index(campaign.current_turn_player_id)

        next_idx = (current_idx + 1) % len(campaign.turn_order)
        next_player = campaign.turn_order[next_idx]
        new_turn_number = campaign.turn_number + 1

        return self.set_turn(campaign_id, next_player, new_turn_number)

    def delete(self, campaign_id: str) -> bool:
        """Delete a campaign."""
        self._table().delete().eq("id", campaign_id).execute()
        return True

    def delete_all(self) -> None:
        """Delete all campaigns (for testing)."""
        # DuckDB doesn't support DELETE without WHERE, so we need a workaround
        # Just delete with a condition that matches everything
        try:
            self._table().delete().execute()
        except Exception:
            pass
