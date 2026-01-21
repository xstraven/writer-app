from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from supabase import Client

from .models import CampaignAction, RPGActionResult
from .services.supabase_client import get_supabase_client


def _generate_id() -> str:
    """Generate a UUID for action ID."""
    return str(uuid.uuid4())


class CampaignActionStore:
    """Store for campaign action history."""

    def __init__(self, *, client: Client | None = None, table: str = "campaign_actions") -> None:
        self._client = client or get_supabase_client()
        self._table_name = table

    def _table(self):
        return self._client.table(self._table_name)

    def _row_to_action(self, row: dict) -> CampaignAction:
        """Convert a database row to a CampaignAction model."""
        action_results = []
        if row.get("action_results"):
            try:
                results_data = json.loads(row["action_results"]) if isinstance(row["action_results"], str) else row["action_results"]
                action_results = [RPGActionResult(**r) for r in results_data]
            except Exception:
                pass

        created_at = row.get("created_at")
        if created_at and isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))

        return CampaignAction(
            id=row["id"],
            campaign_id=row["campaign_id"],
            player_id=row.get("player_id"),
            action_type=row["action_type"],
            content=row["content"],
            action_results=action_results,
            turn_number=row.get("turn_number") or 0,
            created_at=created_at or datetime.now(tz=timezone.utc),
        )

    def create(
        self,
        campaign_id: str,
        action_type: str,
        content: str,
        *,
        player_id: Optional[str] = None,
        action_results: Optional[List[RPGActionResult]] = None,
        turn_number: int = 0,
    ) -> CampaignAction:
        """Create a new action record."""
        now = datetime.now(tz=timezone.utc)
        action_id = _generate_id()

        payload = {
            "id": action_id,
            "campaign_id": campaign_id,
            "player_id": player_id,
            "action_type": action_type,
            "content": content,
            "action_results": json.dumps([r.model_dump() for r in (action_results or [])]),
            "turn_number": turn_number,
            "created_at": now.isoformat(),
        }

        self._table().insert(payload).execute()

        return CampaignAction(
            id=action_id,
            campaign_id=campaign_id,
            player_id=player_id,
            action_type=action_type,
            content=content,
            action_results=action_results or [],
            turn_number=turn_number,
            created_at=now,
        )

    def get(self, action_id: str) -> Optional[CampaignAction]:
        """Get an action by ID."""
        res = self._table().select("*").eq("id", action_id).limit(1).execute()
        rows = res.data or []
        if not rows:
            return None
        return self._row_to_action(rows[0])

    def get_by_campaign(self, campaign_id: str, *, limit: Optional[int] = None) -> List[CampaignAction]:
        """Get all actions for a campaign, ordered by creation time."""
        query = self._table().select("*").eq("campaign_id", campaign_id).order("created_at")
        if limit:
            query = query.limit(limit)
        res = query.execute()
        return [self._row_to_action(row) for row in (res.data or [])]

    def get_recent(self, campaign_id: str, limit: int = 20) -> List[CampaignAction]:
        """Get the most recent actions for a campaign."""
        res = (
            self._table()
            .select("*")
            .eq("campaign_id", campaign_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        # Reverse to get chronological order
        actions = [self._row_to_action(row) for row in (res.data or [])]
        actions.reverse()
        return actions

    def get_by_turn(self, campaign_id: str, turn_number: int) -> List[CampaignAction]:
        """Get all actions for a specific turn."""
        res = (
            self._table()
            .select("*")
            .eq("campaign_id", campaign_id)
            .eq("turn_number", turn_number)
            .order("created_at")
            .execute()
        )
        return [self._row_to_action(row) for row in (res.data or [])]

    def get_narrative_context(self, campaign_id: str, max_chars: int = 4000) -> str:
        """Get recent narrative for context building."""
        actions = self.get_recent(campaign_id, limit=50)

        lines = []
        total_chars = 0

        for action in reversed(actions):  # Start from most recent
            if action.action_type == "player_action":
                line = f"> {action.content}"
            elif action.action_type == "gm_narration":
                line = action.content
            elif action.action_type == "system":
                line = f"[{action.content}]"
            else:
                line = action.content

            if total_chars + len(line) > max_chars:
                break

            lines.insert(0, line)  # Prepend to maintain order
            total_chars += len(line) + 1  # +1 for newline

        return "\n\n".join(lines)

    def delete_by_campaign(self, campaign_id: str) -> bool:
        """Delete all actions for a campaign."""
        self._table().delete().eq("campaign_id", campaign_id).execute()
        return True

    def delete_all(self) -> None:
        """Delete all actions (for testing)."""
        try:
            self._table().delete().execute()
        except Exception:
            pass
