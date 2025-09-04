from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional, Tuple


@dataclass
class SnippetRow:
    id: str
    story: str
    parent_id: Optional[str]
    child_id: Optional[str]
    kind: str
    content: str
    created_at: datetime


class SnippetStore:
    """DuckDB-backed persistent store for story snippets with branching.

    Table schema:
      - id TEXT PRIMARY KEY
      - story TEXT NOT NULL
      - parent_id TEXT NULL
      - child_id TEXT NULL  (the selected active child in the mainline)
      - kind TEXT NOT NULL  (e.g., 'user', 'ai')
      - content TEXT NOT NULL
      - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

    Notes on branching:
      - Multiple children can exist for the same (story, parent_id). The parent's child_id points
        to the currently selected child in the "main" branch.
      - The main branch path is computed by starting at the root (parent_id IS NULL) and following
        child_id pointers until there is no child.
    """

    def __init__(self, path: str | Path = "data/story.duckdb") -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _conn(self):
        # Lazy import to avoid test-time import issues if duckdb is missing.
        import duckdb  # type: ignore

        return duckdb.connect(self.path.as_posix())

    def _init_db(self) -> None:
        with self._conn() as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS snippets (
                    id TEXT PRIMARY KEY,
                    story TEXT NOT NULL,
                    parent_id TEXT,
                    child_id TEXT,
                    kind TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            con.execute("CREATE INDEX IF NOT EXISTS idx_snippets_story ON snippets(story)")
            con.execute(
                "CREATE INDEX IF NOT EXISTS idx_snippets_story_parent ON snippets(story, parent_id)"
            )
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS branches (
                    story TEXT NOT NULL,
                    name TEXT NOT NULL,
                    head_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (story, name)
                )
                """
            )

    def _row_to_obj(self, row: Tuple) -> SnippetRow:
        return SnippetRow(
            id=row[0],
            story=row[1],
            parent_id=row[2],
            child_id=row[3],
            kind=row[4],
            content=row[5],
            created_at=row[6],
        )

    def get(self, snippet_id: str) -> Optional[SnippetRow]:
        with self._lock, self._conn() as con:
            cur = con.execute("SELECT * FROM snippets WHERE id = ?", [snippet_id])
            row = cur.fetchone()
            return self._row_to_obj(row) if row else None

    def list_children(self, story: str, parent_id: str) -> List[SnippetRow]:
        with self._lock, self._conn() as con:
            cur = con.execute(
                "SELECT * FROM snippets WHERE story = ? AND parent_id = ? ORDER BY created_at ASC",
                [story, parent_id],
            )
            return [self._row_to_obj(r) for r in cur.fetchall()]

    def has_children(self, story: str, parent_id: str) -> bool:
        with self._lock, self._conn() as con:
            cur = con.execute(
                "SELECT 1 FROM snippets WHERE story = ? AND parent_id = ? LIMIT 1",
                [story, parent_id],
            )
            return cur.fetchone() is not None

    def _get_root(self, story: str) -> Optional[SnippetRow]:
        with self._lock, self._conn() as con:
            cur = con.execute(
                "SELECT * FROM snippets WHERE story = ? AND parent_id IS NULL ORDER BY created_at DESC LIMIT 1",
                [story],
            )
            row = cur.fetchone()
            return self._row_to_obj(row) if row else None

    def _set_active_child(self, story: str, parent_id: str, child_id: str) -> None:
        with self._lock, self._conn() as con:
            con.execute(
                "UPDATE snippets SET child_id = ? WHERE story = ? AND id = ?",
                [child_id, story, parent_id],
            )

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
        with self._lock, self._conn() as con:
            con.execute(
                "INSERT INTO snippets(id, story, parent_id, child_id, kind, content) VALUES (?, ?, ?, NULL, ?, ?)",
                [snippet_id, story, parent_id, kind, content],
            )
        # Determine active selection behavior.
        if parent_id:
            parent = self.get(parent_id)
            if parent:
                # If caller didn't specify, set active only if no active child exists yet.
                should_activate = (
                    (set_active is None and not parent.child_id) or (set_active is True)
                )
                if should_activate:
                    self._set_active_child(story, parent_id, snippet_id)
        return self.get(snippet_id)  # type: ignore

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
        parent_id = target.parent_id
        # Create sibling (another child of the same parent)
        return self.create_snippet(
            story=story,
            content=content,
            kind=kind,
            parent_id=parent_id,
            set_active=set_active,
        )

    def choose_active_child(self, *, story: str, parent_id: str, child_id: str) -> None:
        child = self.get(child_id)
        if not child or child.story != story or child.parent_id != parent_id:
            raise ValueError("child is not a descendant of parent in this story")
        self._set_active_child(story, parent_id, child_id)

    def main_path(self, story: str) -> List[SnippetRow]:
        """Return the list of snippets along the main branch (root -> head)."""
        root = self._get_root(story)
        if not root:
            return []
        path: List[SnippetRow] = [root]
        cursor = root
        visited = set([root.id])
        while cursor.child_id:
            child = self.get(cursor.child_id)
            if not child or child.story != story:
                break
            if child.id in visited:
                # Safety against cycles
                break
            path.append(child)
            visited.add(child.id)
            cursor = child
        return path

    def path_from_head(self, story: str, head_id: str) -> List[SnippetRow]:
        """Return the chain from root to the given head by following parents backwards."""
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
        if content is None and kind is None:
            return self.get(snippet_id)
        sets = []
        vals: List[object] = []
        if content is not None:
            sets.append("content = ?")
            vals.append(content)
        if kind is not None:
            sets.append("kind = ?")
            vals.append(kind)
        vals.extend([snippet_id])
        sql = f"UPDATE snippets SET {', '.join(sets)} WHERE id = ?"
        with self._lock, self._conn() as con:
            con.execute(sql, vals)
        return self.get(snippet_id)

    def insert_above(
        self, *, story: str, target_snippet_id: str, content: str, kind: str = "user", set_active: bool = True
    ) -> SnippetRow:
        target = self.get(target_snippet_id)
        if not target or target.story != story:
            raise ValueError("target snippet not found")
        old_parent_id = target.parent_id
        new_id = uuid.uuid4().hex
        with self._lock, self._conn() as con:
            # Insert new between target.parent and target
            con.execute(
                "INSERT INTO snippets(id, story, parent_id, child_id, kind, content) VALUES (?, ?, ?, ?, ?, ?)",
                [new_id, story, old_parent_id, target.id, kind, content],
            )
            # Update target to point to new as parent
            con.execute("UPDATE snippets SET parent_id = ? WHERE id = ?", [new_id, target.id])
            # If parent pointed to target on mainline and we should activate, switch to new
            if old_parent_id and set_active:
                cur = con.execute("SELECT child_id FROM snippets WHERE id = ?", [old_parent_id])
                row = cur.fetchone()
                if row and row[0] == target.id:
                    con.execute("UPDATE snippets SET child_id = ? WHERE id = ?", [new_id, old_parent_id])
        return self.get(new_id)  # type: ignore

    def insert_below(
        self, *, story: str, parent_snippet_id: str, content: str, kind: str = "user", set_active: bool = True
    ) -> SnippetRow:
        parent = self.get(parent_snippet_id)
        if not parent or parent.story != story:
            raise ValueError("parent snippet not found")
        new_id = uuid.uuid4().hex
        with self._lock, self._conn() as con:
            # Insert new as child of parent
            con.execute(
                "INSERT INTO snippets(id, story, parent_id, child_id, kind, content) VALUES (?, ?, ?, NULL, ?, ?)",
                [new_id, story, parent.id, kind, content],
            )
            # If parent had an active child, chain it under new
            if parent.child_id:
                con.execute(
                    "UPDATE snippets SET parent_id = ? WHERE id = ?",
                    [new_id, parent.child_id],
                )
                con.execute(
                    "UPDATE snippets SET child_id = ? WHERE id = ?",
                    [parent.child_id, new_id],
                )
            # Set new as active child if requested
            if set_active:
                con.execute("UPDATE snippets SET child_id = ? WHERE id = ?", [new_id, parent.id])
        return self.get(new_id)  # type: ignore

    def delete_snippet(self, *, story: str, snippet_id: str) -> bool:
        target = self.get(snippet_id)
        if not target or target.story != story:
            return False
        # Only allow deleting leaf nodes to preserve graph integrity.
        if self.has_children(story, snippet_id):
            raise ValueError("cannot delete a snippet that has children")
        with self._lock, self._conn() as con:
            if target.parent_id:
                # If parent points to this as active, clear pointer
                cur = con.execute("SELECT child_id FROM snippets WHERE id = ?", [target.parent_id])
                row = cur.fetchone()
                if row and row[0] == target.id:
                    con.execute("UPDATE snippets SET child_id = NULL WHERE id = ?", [target.parent_id])
            con.execute("DELETE FROM snippets WHERE id = ?", [snippet_id])
        return True

    def delete_story(self, story: str) -> None:
        """Delete all snippets and branches for a story."""
        with self._lock, self._conn() as con:
            con.execute("DELETE FROM branches WHERE story = ?", [story])
            con.execute("DELETE FROM snippets WHERE story = ?", [story])

    def list_stories(self) -> list[str]:
        with self._lock, self._conn() as con:
            cur = con.execute("SELECT DISTINCT story FROM snippets ORDER BY story ASC")
            return [r[0] for r in cur.fetchall()]

    def delete_all(self) -> None:
        """Delete all snippets and branches across all stories."""
        with self._lock, self._conn() as con:
            con.execute("DELETE FROM branches")
            con.execute("DELETE FROM snippets")

    # Branch name helpers
    def upsert_branch(self, *, story: str, name: str, head_id: str) -> None:
        with self._lock, self._conn() as con:
            con.execute(
                "INSERT INTO branches(story, name, head_id) VALUES(?, ?, ?) ON CONFLICT(story, name) DO UPDATE SET head_id = excluded.head_id",
                [story, name, head_id],
            )

    def list_branches(self, story: str) -> List[tuple]:
        with self._lock, self._conn() as con:
            cur = con.execute(
                "SELECT story, name, head_id, created_at FROM branches WHERE story = ? ORDER BY created_at DESC",
                [story],
            )
            return list(cur.fetchall())

    def delete_branch(self, *, story: str, name: str) -> None:
        with self._lock, self._conn() as con:
            con.execute("DELETE FROM branches WHERE story = ? AND name = ?", [story, name])
