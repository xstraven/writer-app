from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from supabase import Client

from .models import CharacterSheet, Player
from .services.supabase_client import get_supabase_client


def _generate_id() -> str:
    """Generate a UUID for player ID."""
    return str(uuid.uuid4())


def _generate_session_token() -> str:
    """Generate a session token for the player."""
    return str(uuid.uuid4())


class PlayerStore:
    """Store for player CRUD operations."""

    def __init__(self, *, client: Client | None = None, table: str = "players") -> None:
        self._client = client or get_supabase_client()
        self._table_name = table

    def _table(self):
        return self._client.table(self._table_name)

    def _row_to_player(self, row: dict) -> Player:
        """Convert a database row to a Player model."""
        character_sheet = None
        if row.get("character_sheet"):
            try:
                cs_data = json.loads(row["character_sheet"]) if isinstance(row["character_sheet"], str) else row["character_sheet"]
                character_sheet = CharacterSheet(**cs_data)
            except Exception:
                pass

        joined_at = row.get("joined_at")
        if joined_at and isinstance(joined_at, str):
            joined_at = datetime.fromisoformat(joined_at.replace("Z", "+00:00"))

        last_active_at = row.get("last_active_at")
        if last_active_at and isinstance(last_active_at, str):
            last_active_at = datetime.fromisoformat(last_active_at.replace("Z", "+00:00"))

        return Player(
            id=row["id"],
            campaign_id=row["campaign_id"],
            name=row["name"],
            session_token=row.get("session_token") or "",
            character_sheet=character_sheet,
            is_gm=row.get("is_gm") or False,
            turn_position=row.get("turn_position"),
            joined_at=joined_at or datetime.now(tz=timezone.utc),
            last_active_at=last_active_at,
        )

    def create(
        self,
        campaign_id: str,
        name: str,
        *,
        session_token: Optional[str] = None,
        character_sheet: Optional[CharacterSheet] = None,
        is_gm: bool = False,
        turn_position: Optional[int] = None,
    ) -> Player:
        """Create a new player."""
        now = datetime.now(tz=timezone.utc)
        player_id = _generate_id()
        token = session_token or _generate_session_token()

        payload = {
            "id": player_id,
            "campaign_id": campaign_id,
            "name": name,
            "session_token": token,
            "character_sheet": json.dumps(character_sheet.model_dump()) if character_sheet else None,
            "is_gm": is_gm,
            "turn_position": turn_position,
            "joined_at": now.isoformat(),
            "last_active_at": now.isoformat(),
        }

        self._table().insert(payload).execute()

        return Player(
            id=player_id,
            campaign_id=campaign_id,
            name=name,
            session_token=token,
            character_sheet=character_sheet,
            is_gm=is_gm,
            turn_position=turn_position,
            joined_at=now,
            last_active_at=now,
        )

    def get(self, player_id: str) -> Optional[Player]:
        """Get a player by ID."""
        res = self._table().select("*").eq("id", player_id).limit(1).execute()
        rows = res.data or []
        if not rows:
            return None
        return self._row_to_player(rows[0])

    def get_by_session_token(self, session_token: str) -> Optional[Player]:
        """Get a player by session token."""
        if not session_token:
            return None
        res = self._table().select("*").eq("session_token", session_token).limit(1).execute()
        rows = res.data or []
        if not rows:
            return None
        return self._row_to_player(rows[0])

    def get_by_campaign(self, campaign_id: str) -> List[Player]:
        """Get all players in a campaign."""
        res = self._table().select("*").eq("campaign_id", campaign_id).order("turn_position").execute()
        return [self._row_to_player(row) for row in (res.data or [])]

    def get_by_session_and_campaign(self, session_token: str, campaign_id: str) -> Optional[Player]:
        """Get a player by session token and campaign."""
        if not session_token or not campaign_id:
            return None
        res = (
            self._table()
            .select("*")
            .eq("session_token", session_token)
            .eq("campaign_id", campaign_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        return self._row_to_player(rows[0])

    def list_campaigns_for_session(self, session_token: str) -> List[str]:
        """Get all campaign IDs for a session token."""
        if not session_token:
            return []
        res = self._table().select("campaign_id").eq("session_token", session_token).execute()
        return [row["campaign_id"] for row in (res.data or [])]

    def update(
        self,
        player_id: str,
        *,
        name: Optional[str] = None,
        character_sheet: Optional[CharacterSheet] = None,
        is_gm: Optional[bool] = None,
        turn_position: Optional[int] = None,
    ) -> Optional[Player]:
        """Update a player."""
        updates = {"last_active_at": datetime.now(tz=timezone.utc).isoformat()}

        if name is not None:
            updates["name"] = name
        if character_sheet is not None:
            updates["character_sheet"] = json.dumps(character_sheet.model_dump())
        if is_gm is not None:
            updates["is_gm"] = is_gm
        if turn_position is not None:
            updates["turn_position"] = turn_position

        self._table().update(updates).eq("id", player_id).execute()
        return self.get(player_id)

    def update_character(self, player_id: str, character_sheet: CharacterSheet) -> Optional[Player]:
        """Update a player's character sheet."""
        return self.update(player_id, character_sheet=character_sheet)

    def touch_activity(self, player_id: str) -> None:
        """Update the last_active_at timestamp."""
        self._table().update({
            "last_active_at": datetime.now(tz=timezone.utc).isoformat()
        }).eq("id", player_id).execute()

    def delete(self, player_id: str) -> bool:
        """Delete a player."""
        self._table().delete().eq("id", player_id).execute()
        return True

    def delete_by_campaign(self, campaign_id: str) -> bool:
        """Delete all players in a campaign."""
        self._table().delete().eq("campaign_id", campaign_id).execute()
        return True

    def delete_all(self) -> None:
        """Delete all players (for testing)."""
        try:
            self._table().delete().execute()
        except Exception:
            pass
