from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Optional

from supabase import Client

from .services.supabase_client import get_supabase_client


@dataclass
class SnippetRow:
    id: str
    story: str
    parent_id: Optional[str]
    child_id: Optional[str]
    kind: str
    content: str
    created_at: datetime


def _parse_datetime(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        text = value.replace("Z", "+00:00") if value.endswith("Z") else value
        return datetime.fromisoformat(text)
    raise TypeError(f"Unsupported datetime value: {value!r}")


class SnippetStore:
    def __init__(
        self,
        *,
        client: Client | None = None,
        table: str = "snippets",
        branches_table: str = "branches",
    ) -> None:
        self._client = client or get_supabase_client()
        self._table_name = table
        self._branches_table = branches_table

    def _table(self):
        return self._client.table(self._table_name)

    def _branches(self):
        return self._client.table(self._branches_table)

    def _row_to_obj(self, row: dict) -> SnippetRow:
        return SnippetRow(
            id=row["id"],
            story=row["story"],
            parent_id=row.get("parent_id"),
            child_id=row.get("child_id"),
            kind=row["kind"],
            content=row["content"],
            created_at=_parse_datetime(row["created_at"]),
        )

    def _fetch_snippet(self, snippet_id: str) -> Optional[dict]:
        res = (
            self._table()
            .select("*")
            .eq("id", snippet_id)
            .limit(1)
            .execute()
        )
        data = res.data or []
        return data[0] if data else None

    def _fetch_story_snippets(self, story: str) -> List[dict]:
        res = self._table().select("*").eq("story", story).execute()
        return res.data or []

    def get(self, snippet_id: str) -> Optional[SnippetRow]:
        row = self._fetch_snippet(snippet_id)
        return self._row_to_obj(row) if row else None

    def list_children(self, story: str, parent_id: str) -> List[SnippetRow]:
        res = (
            self._table()
            .select("*")
            .eq("story", story)
            .eq("parent_id", parent_id)
            .order("created_at", desc=False)
            .execute()
        )
        return [self._row_to_obj(r) for r in res.data or []]

    def has_children(self, story: str, parent_id: str) -> bool:
        res = (
            self._table()
            .select("id")
            .eq("story", story)
            .eq("parent_id", parent_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    def _get_root(self, story: str) -> Optional[SnippetRow]:
        rows = self._fetch_story_snippets(story)
        roots = [r for r in rows if r.get("parent_id") is None]
        if not roots:
            return None
        roots.sort(key=lambda r: _parse_datetime(r["created_at"]), reverse=True)
        return self._row_to_obj(roots[0])

    def _set_active_child(self, story: str, parent_id: str, child_id: Optional[str]) -> None:
        self._table().update({"child_id": child_id}).eq("story", story).eq("id", parent_id).execute()

    def create_snippet(
        self,
        *,
        story: str,
        content: str,
        kind: str = "ai",
        parent_id: Optional[str] = None,
        set_active: Optional[bool] = None,
    ) -> SnippetRow:
        snippet_id = uuid.uuid4().hex
        payload = {
            "id": snippet_id,
            "story": story,
            "parent_id": parent_id,
            "child_id": None,
            "kind": kind,
            "content": content,
        }
        self._table().insert(payload).execute()
        if parent_id:
            parent = self.get(parent_id)
            if parent:
                should_activate = (set_active is None and not parent.child_id) or (set_active is True)
                if should_activate:
                    self._set_active_child(story, parent_id, snippet_id)
        row = self._fetch_snippet(snippet_id)
        if not row:
            raise RuntimeError("Failed to fetch inserted snippet")
        return self._row_to_obj(row)

    def regenerate_snippet(
        self,
        *,
        story: str,
        target_snippet_id: str,
        content: str,
        kind: str = "ai",
        set_active: bool = True,
    ) -> SnippetRow:
        target = self.get(target_snippet_id)
        if not target:
            raise ValueError("target snippet not found")
        return self.create_snippet(
            story=story,
            content=content,
            kind=kind,
            parent_id=target.parent_id,
            set_active=set_active,
        )

    def choose_active_child(self, *, story: str, parent_id: str, child_id: str) -> None:
        child = self.get(child_id)
        if not child or child.story != story or child.parent_id != parent_id:
            raise ValueError("child is not a descendant of parent in this story")
        self._set_active_child(story, parent_id, child_id)

    def main_path(self, story: str) -> List[SnippetRow]:
        root = self._get_root(story)
        if not root:
            return []
        path: List[SnippetRow] = [root]
        cursor = root
        visited = {root.id}
        while cursor.child_id:
            child = self.get(cursor.child_id)
            if not child or child.story != story or child.id in visited:
                break
            path.append(child)
            visited.add(child.id)
            cursor = child
        return path

    def path_from_head(self, story: str, head_id: str) -> List[SnippetRow]:
        head = self.get(head_id)
        if not head or head.story != story:
            return []
        chain: List[SnippetRow] = []
        cursor = head
        visited = set()
        while cursor:
            if cursor.id in visited:
                break
            chain.append(cursor)
            visited.add(cursor.id)
            if cursor.parent_id:
                parent = self.get(cursor.parent_id)
                if not parent or parent.story != story:
                    break
                cursor = parent
            else:
                break
        chain.reverse()
        return chain

    @staticmethod
    def build_text(path: Iterable[SnippetRow]) -> str:
        return "\n\n".join([s.content for s in path if s.content])

    def update_snippet(
        self, *, snippet_id: str, content: Optional[str] = None, kind: Optional[str] = None
    ) -> Optional[SnippetRow]:
        updates = {}
        if content is not None:
            updates["content"] = content
        if kind is not None:
            updates["kind"] = kind
        if not updates:
            return self.get(snippet_id)
        self._table().update(updates).eq("id", snippet_id).execute()
        return self.get(snippet_id)

    def insert_above(
        self,
        *,
        story: str,
        target_snippet_id: str,
        content: str,
        kind: str = "user",
        set_active: bool = True,
    ) -> SnippetRow:
        target = self.get(target_snippet_id)
        if not target or target.story != story:
            raise ValueError("target snippet not found")
        old_parent_id = target.parent_id
        new_id = uuid.uuid4().hex
        self._table().insert(
            {
                "id": new_id,
                "story": story,
                "parent_id": old_parent_id,
                "child_id": target.id,
                "kind": kind,
                "content": content,
            }
        ).execute()
        self._table().update({"parent_id": new_id}).eq("id", target.id).execute()
        if old_parent_id and set_active:
            parent = self.get(old_parent_id)
            if parent and parent.child_id == target.id:
                self._set_active_child(story, old_parent_id, new_id)
        new_row = self._fetch_snippet(new_id)
        if not new_row:
            raise RuntimeError("Failed to fetch inserted snippet")
        return self._row_to_obj(new_row)

    def insert_below(
        self,
        *,
        story: str,
        parent_snippet_id: str,
        content: str,
        kind: str = "user",
        set_active: bool = True,
    ) -> SnippetRow:
        parent = self.get(parent_snippet_id)
        if not parent or parent.story != story:
            raise ValueError("parent snippet not found")
        new_id = uuid.uuid4().hex
        self._table().insert(
            {
                "id": new_id,
                "story": story,
                "parent_id": parent.id,
                "child_id": None,
                "kind": kind,
                "content": content,
            }
        ).execute()
        if parent.child_id:
            self._table().update({"parent_id": new_id}).eq("id", parent.child_id).execute()
            self._table().update({"child_id": parent.child_id}).eq("id", new_id).execute()
        if set_active:
            self._set_active_child(story, parent.id, new_id)
        new_row = self._fetch_snippet(new_id)
        if not new_row:
            raise RuntimeError("Failed to fetch inserted snippet")
        return self._row_to_obj(new_row)

    def delete_snippet(self, *, story: str, snippet_id: str) -> bool:
        target = self.get(snippet_id)
        if not target or target.story != story:
            return False
        if target.parent_id is None:
            raise ValueError("cannot delete the root snippet")
        branch_rows = (
            self._branches()
            .select("name")
            .eq("story", story)
            .eq("head_id", snippet_id)
            .execute()
        )
        branch_names = [row["name"] for row in branch_rows.data or [] if row.get("name")]
        replacement_head_id: Optional[str] = None
        children = self.list_children(story, target.id)
        if children:
            active_child_id = target.child_id or children[-1].id
            for child in children:
                self._table().update({"parent_id": target.parent_id}).eq("id", child.id).execute()
            parent = self.get(target.parent_id)
            if parent and parent.child_id == target.id:
                self._set_active_child(story, parent.id, active_child_id)
            replacement_head_id = active_child_id
        else:
            parent = self.get(target.parent_id)
            if parent and parent.child_id == target.id:
                self._set_active_child(story, parent.id, None)
            replacement_head_id = parent.id if parent else None
        self._table().delete().eq("id", snippet_id).execute()
        if branch_names:
            if replacement_head_id:
                for name in branch_names:
                    self._branches().upsert(
                        {"story": story, "name": name, "head_id": replacement_head_id},
                        on_conflict="story,name",
                    ).execute()
            else:
                for name in branch_names:
                    self._branches().delete().eq("story", story).eq("name", name).execute()
        return True

    def delete_story(self, story: str) -> None:
        self._branches().delete().eq("story", story).execute()
        self._table().delete().eq("story", story).execute()

    def truncate_story(self, story: str) -> SnippetRow:
        """Remove all snippets for the story and return a fresh empty root snippet."""
        self._branches().delete().eq("story", story).execute()
        self._table().delete().eq("story", story).execute()
        return self.create_snippet(story=story, content="", kind="user", parent_id=None)

    def list_stories(self) -> list[str]:
        res = self._table().select("story").execute()
        stories = {row["story"] for row in res.data or [] if row.get("story")}
        return sorted(stories)

    def delete_all(self) -> None:
        self._branches().delete().execute()
        self._table().delete().execute()

    def upsert_branch(self, *, story: str, name: str, head_id: str) -> None:
        self._branches().upsert(
            {"story": story, "name": name, "head_id": head_id},
            on_conflict="story,name",
        ).execute()

    def list_branches(self, story: str) -> List[tuple]:
        res = (
            self._branches()
            .select("story,name,head_id,created_at")
            .eq("story", story)
            .order("created_at", desc=True)
            .execute()
        )
        rows = res.data or []
        return [
            (
                r["story"],
                r["name"],
                r["head_id"],
                _parse_datetime(r["created_at"]),
            )
            for r in rows
        ]

    def delete_branch(self, *, story: str, name: str) -> None:
        self._branches().delete().eq("story", story).eq("name", name).execute()

    def _list_all_snippets(self, story: str) -> List[SnippetRow]:
        res = (
            self._table()
            .select("*")
            .eq("story", story)
            .order("created_at", desc=False)
            .execute()
        )
        return [self._row_to_obj(r) for r in res.data or []]

    def duplicate_story_all(self, *, source: str, target: str) -> dict:
        rows = self._list_all_snippets(source)
        if not rows:
            return {"id_map": {}}
        id_map: dict[str, str] = {r.id: uuid.uuid4().hex for r in rows}
        inserts = []
        for r in rows:
            inserts.append(
                {
                    "id": id_map[r.id],
                    "story": target,
                    "parent_id": id_map.get(r.parent_id) if r.parent_id else None,
                    "child_id": id_map.get(r.child_id) if r.child_id else None,
                    "kind": r.kind,
                    "content": r.content,
                    "created_at": r.created_at.isoformat(),
                }
            )
        self._table().insert(inserts).execute()
        branch_resp = (
            self._branches()
            .select("name,head_id")
            .eq("story", source)
            .execute()
        )
        for row in branch_resp.data or []:
            head_id = row.get("head_id")
            new_head = id_map.get(head_id) if head_id else None
            if new_head:
                self._branches().upsert(
                    {"story": target, "name": row["name"], "head_id": new_head},
                    on_conflict="story,name",
                ).execute()
        return {"id_map": id_map}

    def duplicate_story_main(self, *, source: str, target: str) -> dict:
        branches = self.list_branches(source)
        main_branch = next((b for b in branches if b[1] == "main"), None)
        if main_branch:
            path = self.path_from_head(source, main_branch[2])
        else:
            path = self.main_path(source)
        if not path:
            return {"id_map": {}}
        id_map: dict[str, str] = {r.id: uuid.uuid4().hex for r in path}
        inserts = []
        for r in path:
            inserts.append(
                {
                    "id": id_map[r.id],
                    "story": target,
                    "parent_id": id_map.get(r.parent_id) if r.parent_id else None,
                    "child_id": None,
                    "kind": r.kind,
                    "content": r.content,
                    "created_at": r.created_at.isoformat(),
                }
            )
        self._table().insert(inserts).execute()
        self._branches().upsert(
            {"story": target, "name": "main", "head_id": id_map[path[-1].id]},
            on_conflict="story,name",
        ).execute()
        return {"id_map": id_map}
