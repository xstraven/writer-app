from __future__ import annotations

import os
from typing import Optional

import reflex as rx
import httpx


# Configurable API base; default to 8001 to avoid Reflex dev backend (8000).
API_BASE = os.environ.get("STORYCRAFT_API_BASE", "http://127.0.0.1:8001")


class MemoryItem(rx.Base):
    type: str
    label: str
    detail: str


class MemoryState(rx.Base):
    characters: list[MemoryItem] = []
    subplots: list[MemoryItem] = []
    facts: list[MemoryItem] = []


class LoreEntry(rx.Base):
    id: str
    story: str
    name: str
    kind: str
    summary: str
    tags: list[str] = []
    keys: list[str] = []
    always_on: bool = False


class ContextItem(rx.Base):
    label: str
    detail: str


class ContextState(rx.Base):
    summary: str = ""
    npcs: list[ContextItem] = []
    objects: list[ContextItem] = []


class Snippet(rx.Base):
    id: str
    story: str
    parent_id: Optional[str] = None
    child_id: Optional[str] = None
    kind: str
    content: str
    created_at: str


class EditableChunk(rx.Base):
    id: str
    kind: str
    content: str


class TreeNode(rx.Base):
    parent: Snippet
    children: list[Snippet] = []


class BranchInfo(rx.Base):
    story: str
    name: str
    head_id: str
    created_at: str


class PromptMessage(rx.Base):
    role: str
    content: str


class AppState(rx.State):
    draft_text: str = ""
    instruction: str = ""
    continuation: str = ""
    status: str = "idle"
    model: str = "openrouter/auto"
    temperature: float = 0.7
    max_tokens: int = 512
    # Advanced: system prompt override for LLM
    system_prompt: str = (
        "You are an expert creative writing assistant. Continue the user's story in the same voice,"
        " tone, and perspective. Always preserve established canon, character continuity, and"
        " world-building details. If given instructions, apply them elegantly."
    )

    lore: list[LoreEntry] = []
    selected_lore_ids: list[str] = []
    lore_keys_input: dict[str, str] = {}
    memory: MemoryState = MemoryState()
    context: ContextState = ContextState()
    include_context: bool = True
    include_memory: bool = True

    # UI: story switching (ephemeral, not persisted to backend)
    story_options: list[str] = ["Story One", "Story Two"]
    current_story: str = "Story One"
    stories: dict[str, dict] = {}

    # UI: modal/drawer visibility
    show_lorebook: bool = False
    show_branches: bool = False
    show_settings: bool = False
    show_meta_panel: bool = False
    backend_ok: bool = False
    backend_msg: str = ""

    # Branching state (server-backed)
    branch_path: list[Snippet] = []
    head_id: Optional[str] = None
    last_parent_id: Optional[str] = None
    last_parent_active_child_id: Optional[str] = None
    last_parent_children: list[Snippet] = []

    chunk_edit_list: list[EditableChunk] = []

    # Tree and branches
    tree_rows: list[TreeNode] = []
    branches: list[BranchInfo] = []
    branch_name_input: str = ""

    # Confirm dialog state
    show_confirm_flatten: bool = False

    # UI: chunks display preferences
    seamless_chunks: bool = True
    show_chunk_editors: bool = False
    joined_chunks_text: str = ""
    # Inline composer for a new user chunk appended at the end of the draft.
    new_chunk_text: str = ""

    # Controlled inputs for new lore entry (avoid deprecated refs API).
    new_lore_name: str = ""
    new_lore_kind: str = ""
    new_lore_summary: str = ""

    # Controlled inputs for context item creation
    new_npc_label: str = ""
    new_npc_detail: str = ""
    new_object_label: str = ""
    new_object_detail: str = ""

    # Prompt preview
    show_prompt_preview: bool = False
    prompt_messages: list[PromptMessage] = []

    # UI event helpers for numeric inputs coming in as strings from the browser.
    def update_temperature(self, value: str):
        try:
            self.temperature = float(value)
        except Exception:
            pass

    def update_max_tokens(self, value: str):
        try:
            self.max_tokens = int(float(value))
        except Exception:
            pass

    # --- Story switching helpers (local only) ---
    def _snapshot_state(self) -> dict:
        return {
            "draft_text": self.draft_text,
            "instruction": self.instruction,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "include_context": self.include_context,
            "include_memory": self.include_memory,
            "context": self._context_payload(),
            "system_prompt": self.system_prompt,
            "selected_lore_ids": list(self.selected_lore_ids),
        }

    def _apply_snapshot(self, data: dict):
        self.draft_text = data.get("draft_text", "")
        self.instruction = data.get("instruction", "")
        self.model = data.get("model") or self.model
        self.temperature = float(data.get("temperature", self.temperature))
        self.max_tokens = int(data.get("max_tokens", self.max_tokens))
        self.system_prompt = data.get("system_prompt") or self.system_prompt
        self.selected_lore_ids = list(data.get("selected_lore_ids", []))
        self.include_context = bool(data.get("include_context", self.include_context))
        self.include_memory = bool(data.get("include_memory", self.include_memory))
        ctx = data.get("context") or {}
        self.context = ContextState(
            summary=ctx.get("summary", ""),
            npcs=[ContextItem(**x) for x in ctx.get("npcs", [])],
            objects=[ContextItem(**x) for x in ctx.get("objects", [])],
        )
        # Branch state is reloaded from server separately.

    async def switch_story(self, value: str):
        # Best-effort: persist any unsaved chunk edits before switching stories.
        try:
            await self.save_all_chunks()
        except Exception:
            # Non-fatal; continue switching stories even if saves fail.
            pass
        # Save current under existing key
        self.stories[self.current_story] = self._snapshot_state()
        self.current_story = value
        if value in self.stories:
            self._apply_snapshot(self.stories[value])
        else:
            # New story: clear to defaults
            self.draft_text = ""
            self.instruction = ""
            self.continuation = ""
        # Clear branch-related UI and reload for the new story
        self.branch_path = []
        self.chunk_edit_list = []
        self.joined_chunks_text = ""
        self.head_id = None
        self.last_parent_id = None
        self.last_parent_active_child_id = None
        self.last_parent_children = []
        await self.reload_branch()
        await self.load_lore()

    async def create_story(self):
        base = "Untitled"
        i = 1
        existing = set(self.story_options)
        name = f"{base} {i}"
        while name in existing:
            i += 1
            name = f"{base} {i}"
        self.story_options = list(self.story_options) + [name]
        await self.switch_story(name)

    async def load_lore(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{API_BASE}/api/lorebook", params={"story": self.current_story})
            r.raise_for_status()
            data = r.json()
        self.lore = [LoreEntry(**x) for x in data]
        # Initialize keys editor mapping
        mapping: dict[str, str] = {}
        for it in self.lore:
            try:
                mapping[it.id] = ", ".join(list(it.keys)) if getattr(it, "keys", []) else ""
            except Exception:
                mapping[it.id] = ""
        self.lore_keys_input = mapping

    async def probe_backend(self):
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{API_BASE}/health")
                r.raise_for_status()
                data = r.json()
            self.backend_ok = data.get("status") == "ok"
            self.backend_msg = "ok" if self.backend_ok else "not ok"
        except Exception as e:
            self.backend_ok = False
            self.backend_msg = f"error: {e}"

    def open_lorebook(self):
        self.show_lorebook = True

    def close_lorebook(self):
        self.show_lorebook = False

    # Drawers: branches & settings
    def open_branches(self):
        self.show_branches = True

    def close_branches(self):
        self.show_branches = False

    def open_settings(self):
        self.show_settings = True

    def close_settings(self):
        self.show_settings = False

    # Prompt preview panel
    async def open_prompt_preview(self):
        # Build draft similar to do_continue composition
        base_text = self.joined_chunks_text or "\n\n".join([s.content for s in self.branch_path])
        extra = (self.new_chunk_text or "").strip()
        draft_text = base_text if not extra else (base_text + ("\n\n" if base_text else "") + extra)
        payload = {
            "draft_text": draft_text,
            "instruction": self.instruction,
            "model": self.model,
            "use_memory": self.include_memory,
            "use_context": self.include_context,
            "story": self.current_story,
            "lore_ids": list(self.selected_lore_ids),
            "system_prompt": self.system_prompt,
        }
        if self.include_context:
            payload["context"] = self._context_payload()
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{API_BASE}/api/prompt-preview", json=payload)
            r.raise_for_status()
            data = r.json()
        msgs = [PromptMessage(**m) for m in data.get("messages", [])]
        self.prompt_messages = msgs
        self.show_prompt_preview = True

    def close_prompt_preview(self):
        self.show_prompt_preview = False

    # Panel: story/meta + lorebook
    def open_meta_panel(self):
        self.show_meta_panel = True

    def close_meta_panel(self):
        self.show_meta_panel = False

    async def load_stories(self):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"{API_BASE}/api/stories")
                r.raise_for_status()
                data = r.json()
            options = [str(x) for x in (data or [])]
            # Ensure current story is present
            if self.current_story not in options and self.current_story:
                options = options + [self.current_story]
            self.story_options = options
        except Exception:
            # Keep existing defaults on error
            pass

    async def load_state(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{API_BASE}/api/state")
            r.raise_for_status()
            data = r.json()
        # Map to current state (with defaults)
        self.draft_text = data.get("draft_text", self.draft_text)
        self.instruction = data.get("instruction", self.instruction)
        self.model = data.get("model") or self.model
        self.temperature = float(data.get("temperature", self.temperature))
        self.max_tokens = int(data.get("max_tokens", self.max_tokens))
        self.system_prompt = data.get("system_prompt") or self.system_prompt
        self.include_context = bool(data.get("include_context", self.include_context))
        self.include_memory = bool(data.get("include_memory", self.include_memory))
        ctx = data.get("context") or {}
        self.context = ContextState(
            summary=ctx.get("summary", ""),
            npcs=[ContextItem(**x) for x in ctx.get("npcs", [])],
            objects=[ContextItem(**x) for x in ctx.get("objects", [])],
        )
        # Branch state is reloaded from server separately.

    async def save_state(self):
        payload = {
            "draft_text": self.draft_text,
            "instruction": self.instruction,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "system_prompt": self.system_prompt,
            "include_context": self.include_context,
            "include_memory": self.include_memory,
            "context": self._context_payload(),
            # generations/gen_index are deprecated in favor of server-backed branches
        }
        async with httpx.AsyncClient() as client:
            r = await client.put(f"{API_BASE}/api/state", json=payload)
            r.raise_for_status()

    # --- Branching helpers ---

    async def reload_branch(self):
        story = self.current_story
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{API_BASE}/api/snippets/path", params={"story": story})
            r.raise_for_status()
            data = r.json()
        # Map path and text
        self.branch_path = [Snippet(**x) for x in data.get("path", [])]
        self.head_id = data.get("head_id")
        self.draft_text = data.get("text", self.draft_text)
        # Initialize editable list mirror of current path
        self.chunk_edit_list = [EditableChunk(id=s.id, kind=s.kind, content=s.content) for s in self.branch_path]
        # Build joined text for seamless display (kept in sync with edits)
        self.joined_chunks_text = "\n\n".join([e.content for e in self.chunk_edit_list])
        # Determine last parent (the node whose children we can switch among)
        if len(self.branch_path) >= 2:
            parent = self.branch_path[-2]
            self.last_parent_id = parent.id
            self.last_parent_active_child_id = parent.child_id
            await self.load_children_for_last_parent()
        else:
            self.last_parent_id = None
            self.last_parent_active_child_id = None
            self.last_parent_children = []
        await self.load_tree()
        await self.load_branches()

    async def load_children_for_last_parent(self):
        if not self.last_parent_id:
            self.last_parent_children = []
            return
        story = self.current_story
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{API_BASE}/api/snippets/children/{self.last_parent_id}",
                params={"story": story},
            )
            r.raise_for_status()
            data = r.json()
        self.last_parent_children = [Snippet(**x) for x in data]

    async def choose_active_child(self, child_id: str):
        if not self.last_parent_id:
            return
        story = self.current_story
        payload = {"story": story, "parent_id": self.last_parent_id, "child_id": child_id}
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{API_BASE}/api/snippets/choose-active", json=payload)
            r.raise_for_status()
        await self.reload_branch()

    async def regenerate_latest(self):
        if not self.branch_path:
            return
        target = self.branch_path[-1]
        story = self.current_story
        payload = {
            "story": story,
            "target_snippet_id": target.id,
            "instruction": self.instruction,
            "max_tokens": self.max_tokens,
            "model": self.model,
            "use_memory": True,
            "temperature": self.temperature,
            "use_context": self.include_context,
        }
        if self.include_context:
            payload["context"] = self._context_payload()
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{API_BASE}/api/snippets/regenerate-ai", json=payload)
            r.raise_for_status()
        await self.reload_branch()

    async def commit_user_chunk(self):
        story = self.current_story
        # Prefer the dedicated composer input if provided, else fall back to diffing draft_text.
        chunk = (self.new_chunk_text or "").strip()
        if not chunk:
            # Build base text from current branch and infer tail from draft_text.
            base_text = "\n\n".join([s.content for s in self.branch_path])
            draft = self.draft_text or ""
            if base_text:
                if not draft.startswith(base_text):
                    self.status = "error: draft diverged; refresh branch first"
                    return
                chunk = draft[len(base_text):].lstrip("\n")
            else:
                chunk = draft.strip()
            if not chunk.strip():
                return
        parent_id = self.head_id
        payload = {
            "story": story,
            "content": chunk,
            "kind": "user",
            "parent_id": parent_id,
            "set_active": True,
        }
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{API_BASE}/api/snippets/append", json=payload)
            r.raise_for_status()
        await self.reload_branch()
        await self.save_state()
        # Clear composer and instruction after committing
        self.new_chunk_text = ""
        self.instruction = ""

    def set_chunk_edit(self, sid: str, value: str):
        # Update content for the editable chunk with the given id.
        items = []
        for it in self.chunk_edit_list:
            if it.id == sid:
                it = EditableChunk(id=it.id, kind=it.kind, content=value)
            items.append(it)
        self.chunk_edit_list = items
        # Update seamless joined text live as edits happen
        self.joined_chunks_text = "\n\n".join([e.content for e in items])

    def set_chunk_edits_bulk(self, items: list[dict]):
        """Update many chunk edits at once (from TipTap).

        Expects a list of dicts with keys: id, content, kind.
        Preserves order and updates joined text. Does not persist.
        """
        try:
            mapping = {str(x.get("id")): str(x.get("content", "")) for x in (items or [])}
        except Exception:
            return
        out: list[EditableChunk] = []
        # Preserve existing order and kinds where possible
        for it in self.chunk_edit_list:
            c = mapping.get(it.id, it.content)
            out.append(EditableChunk(id=it.id, kind=it.kind, content=c))
        # If wrapper sent different ordering or missing items, fall back to full replace
        if len(items or []) != len(out):
            try:
                out = [EditableChunk(id=str(x.get("id")), kind=str(x.get("kind", "user")), content=str(x.get("content", ""))) for x in (items or [])]
            except Exception:
                pass
        self.chunk_edit_list = out
        self.joined_chunks_text = "\n\n".join([e.content for e in self.chunk_edit_list])

    async def save_chunk(self, sid: str):
        # Find snippet; fall back to existing content if no edit.
        snippet = next((s for s in self.branch_path if s.id == sid), None)
        if not snippet:
            return
        # Find edited version if any
        edit = next((e for e in self.chunk_edit_list if e.id == sid), None)
        content = edit.content if edit else snippet.content
        payload = {"content": content}
        # Persist to backend
        async with httpx.AsyncClient() as client:
            r = await client.put(f"{API_BASE}/api/snippets/{sid}", json=payload)
            r.raise_for_status()
        # Update local snapshot inline to avoid a full reload flicker
        updated_path: list[Snippet] = []
        for s in self.branch_path:
            if s.id == sid:
                updated_path.append(Snippet(id=s.id, story=s.story, parent_id=s.parent_id, child_id=s.child_id, kind=s.kind, content=content, created_at=s.created_at))
            else:
                updated_path.append(s)
        self.branch_path = updated_path
        # joined_chunks_text already tracks edits as you type; keep it in sync
        self.joined_chunks_text = "\n\n".join([e.content for e in self.chunk_edit_list])

    async def save_all_chunks(self):
        """Persist all edited chunks that differ from server path.

        Called before potentially disruptive actions (e.g., switching stories)
        to reduce the chance of losing recent edits if blur-based autosave
        hasn't fired yet.
        """
        if not self.branch_path or not self.chunk_edit_list:
            return
        # Build lookup for current server path
        path_map = {s.id: s for s in self.branch_path}
        # For each edited chunk, save if content changed
        async with httpx.AsyncClient() as client:
            for e in self.chunk_edit_list:
                s = path_map.get(e.id)
                if not s:
                    continue
                if e.content != s.content:
                    payload = {"content": e.content}
                    try:
                        r = await client.put(f"{API_BASE}/api/snippets/{e.id}", json=payload)
                        r.raise_for_status()
                    except Exception:
                        # Continue best-effort; individual failures shouldn't block others
                        pass

    async def commit_entire_draft_as_root(self):
        content = (self.draft_text or "").strip()
        if not content:
            return
        payload = {"story": self.current_story, "content": content, "kind": "user", "parent_id": None}
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{API_BASE}/api/snippets/append", json=payload)
            r.raise_for_status()
        await self.reload_branch()
        await self.save_state()

    # Insert / Delete
    async def insert_above(self, target_id: str, content: str):
        content = (content or "").strip()
        if not content:
            return
        payload = {
            "story": self.current_story,
            "target_snippet_id": target_id,
            "content": content,
            "kind": "user",
            "set_active": True,
        }
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{API_BASE}/api/snippets/insert-above", json=payload)
            r.raise_for_status()
        await self.reload_branch()

    async def insert_below(self, parent_id: str, content: str):
        content = (content or "").strip()
        if not content:
            return
        payload = {
            "story": self.current_story,
            "parent_snippet_id": parent_id,
            "content": content,
            "kind": "user",
            "set_active": True,
        }
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{API_BASE}/api/snippets/insert-below", json=payload)
            r.raise_for_status()
        await self.reload_branch()

    async def delete_snippet(self, snippet_id: str):
        async with httpx.AsyncClient() as client:
            r = await client.delete(f"{API_BASE}/api/snippets/{snippet_id}", params={"story": self.current_story})
        if r.status_code == 200:
            await self.reload_branch()
        else:
            self.status = f"error: {r.text}"

    async def revert_head(self):
        """Revert the latest head snippet.

        Strategy:
        - If there is a parent (path length >= 2), pick an alternative child for the parent
          if one exists (the most recent other child), set it active, then delete the head.
        - If no alternative child exists, just delete the head to move the head back to the parent.
        - If path has fewer than 2 nodes (no parent), do nothing to avoid deleting the only root.
        """
        if not self.branch_path or len(self.branch_path) < 2:
            return
        head = self.branch_path[-1]
        parent = self.branch_path[-2]
        # Try to find an alternate child for the parent (excluding current head)
        alt_child_id: str | None = None
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{API_BASE}/api/snippets/children/{parent.id}",
                    params={"story": self.current_story},
                )
                r.raise_for_status()
                data = r.json()
            # Sort by created_at and pick the most recent alternative child
            # created_at is ISO string from Pydantic; rely on server order if parsing is tricky
            children = [Snippet(**x) for x in data if x.get("id") != head.id]
            if children:
                # Pick the last item (they are ordered ASC by created_at in store)
                alt_child_id = children[-1].id
        except Exception:
            alt_child_id = None

        # If we found an alternate, switch to it
        if alt_child_id:
            payload = {"story": self.current_story, "parent_id": parent.id, "child_id": alt_child_id}
            async with httpx.AsyncClient() as client:
                r = await client.post(f"{API_BASE}/api/snippets/choose-active", json=payload)
                r.raise_for_status()

        # Now delete the current head (must be a leaf to succeed)
        async with httpx.AsyncClient() as client:
            r = await client.delete(
                f"{API_BASE}/api/snippets/{head.id}", params={"story": self.current_story}
            )
            # Ignore failure here; caller can inspect status if needed
        await self.reload_branch()
        await self.save_state()

    async def perform_chunk_action(self, sid: str, action: str):
        """Perform a contextual action for a chunk from a compact menu.

        Supported actions: 'edit', 'insert_above', 'insert_below', 'delete'
        """
        a = (action or "").strip().lower()
        if not a:
            return
        if a == "edit":
            # Reveal editors to allow inline editing of the chosen chunk
            self.show_chunk_editors = True
            return
        if a == "insert_above":
            await self.insert_above(sid, "(write here)")
            return
        if a == "insert_below":
            await self.insert_below(sid, "(write here)")
            return
        if a == "delete":
            await self.delete_snippet(sid)
            return

    # Tree & Branches
    async def load_tree(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{API_BASE}/api/snippets/tree-main", params={"story": self.current_story})
            r.raise_for_status()
            data = r.json()
        # Build rows; active child shown by comparing parent.child_id
        rows: list[TreeNode] = []
        for row in data.get("rows", []):
            parent = Snippet(**row["parent"])  # type: ignore
            children = [Snippet(**c) for c in row.get("children", [])]
            rows.append(TreeNode(parent=parent, children=children))
        self.tree_rows = rows

    async def load_branches(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{API_BASE}/api/branches", params={"story": self.current_story})
            r.raise_for_status()
            data = r.json()
        self.branches = [BranchInfo(**b) for b in data]

    def set_branch_name_input(self, value: str):
        self.branch_name_input = value

    async def save_branch(self):
        name = (self.branch_name_input or "").strip()
        if not name or not self.head_id:
            return
        payload = {"story": self.current_story, "name": name, "head_id": self.head_id}
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{API_BASE}/api/branches", json=payload)
            r.raise_for_status()
        self.branch_name_input = ""
        await self.load_branches()

    async def switch_to_head(self, head_id: str):
        # Reconstruct path to head by walking parents upward
        chain: list[Snippet] = []
        current_id = head_id
        async with httpx.AsyncClient() as client:
            while True:
                r = await client.get(f"{API_BASE}/api/snippets/{current_id}", params={"story": self.current_story})
                if r.status_code != 200:
                    break
                node = Snippet(**r.json())
                chain.append(node)
                if not node.parent_id:
                    break
                current_id = node.parent_id
        chain.reverse()
        # Select the path by setting each parent's active child
        for i in range(len(chain) - 1):
            child = chain[i + 1]
            await self.choose_active_child(child.id)
        await self.reload_branch()

    async def switch_branch(self, name: str):
        # Find branch head and switch
        br = next((b for b in self.branches if b.name == name), None)
        if not br:
            return
        await self.switch_to_head(br.head_id)

    async def delete_branch(self, name: str):
        async with httpx.AsyncClient() as client:
            r = await client.delete(f"{API_BASE}/api/branches/{name}", params={"story": self.current_story})
            r.raise_for_status()
        await self.load_branches()

    # Confirm flatten dialog
    def open_confirm_flatten(self):
        self.show_confirm_flatten = True

    def close_confirm_flatten(self):
        self.show_confirm_flatten = False

    async def confirm_flatten_and_commit(self):
        await self.commit_entire_draft_as_root()
        self.show_confirm_flatten = False

    async def add_lore(self, name: str, kind: str, summary: str):
        payload = {"story": self.current_story, "name": name, "kind": kind, "summary": summary, "tags": []}
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{API_BASE}/api/lorebook", json=payload)
            r.raise_for_status()
            data = r.json()
        entry = LoreEntry(**data)
        self.lore.append(entry)
        self.lore_keys_input[entry.id] = ""

    async def delete_lore(self, entry_id: str):
        async with httpx.AsyncClient() as client:
            r = await client.delete(f"{API_BASE}/api/lorebook/{entry_id}")
            r.raise_for_status()
        self.lore = [x for x in self.lore if x.id != entry_id]
        if entry_id in self.lore_keys_input:
            m = dict(self.lore_keys_input)
            m.pop(entry_id, None)
            self.lore_keys_input = m

    async def set_lore_always_on(self, entry_id: str, value: bool):
        async with httpx.AsyncClient() as client:
            r = await client.put(
                f"{API_BASE}/api/lorebook/{entry_id}", json={"always_on": bool(value)}
            )
            r.raise_for_status()
            data = r.json()
        # Update local list
        updated = LoreEntry(**data)
        self.lore = [updated if x.id == entry_id else x for x in self.lore]

    def _normalize_entry_id(self, entry_id) -> str:
        try:
            if isinstance(entry_id, dict):
                for k in ("id", "value"):
                    v = entry_id.get(k)
                    if isinstance(v, str):
                        return v
                return str(entry_id)
            return str(entry_id)
        except Exception:
            return str(entry_id)

    def set_lore_keys_input(self, entry_id: str, value: str):
        eid = self._normalize_entry_id(entry_id)
        m = dict(self.lore_keys_input)
        m[eid] = value
        self.lore_keys_input = m

    async def save_lore_keys(self, entry_id: str):
        eid = self._normalize_entry_id(entry_id)
        raw = self.lore_keys_input.get(eid, "")
        keys: list[str] = []
        for part in (raw or "").split(','):
            k = part.strip()
            if k:
                keys.append(k)
        async with httpx.AsyncClient() as client:
            r = await client.put(f"{API_BASE}/api/lorebook/{eid}", json={"keys": keys})
            r.raise_for_status()
            data = r.json()
        updated = LoreEntry(**data)
        self.lore = [updated if x.id == eid else x for x in self.lore]

    async def extract_memory(self):
        if not self.draft_text.strip():
            self.memory = MemoryState()
            return
        payload = {"current_text": self.draft_text, "model": self.model, "max_items": 12}
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{API_BASE}/api/extract-memory", json=payload)
            r.raise_for_status()
            data = r.json()
        self.memory = MemoryState(**data)

    def set_context_summary(self, value: str):
        self.context.summary = value

    def add_npc(self, label: str, detail: str):
        label = (label or "").strip()
        detail = (detail or "").strip()
        if not label:
            return
        npcs = list(self.context.npcs) + [ContextItem(label=label, detail=detail)]
        self.context.npcs = npcs
        self.new_npc_label = ""
        self.new_npc_detail = ""

    def add_npc_from_inputs(self):
        self.add_npc(self.new_npc_label, self.new_npc_detail)

    def remove_npc(self, label: str):
        self.context.npcs = [x for x in self.context.npcs if x.label != label]

    def add_object(self, label: str, detail: str):
        label = (label or "").strip()
        detail = (detail or "").strip()
        if not label:
            return
        objs = list(self.context.objects) + [ContextItem(label=label, detail=detail)]
        self.context.objects = objs
        self.new_object_label = ""
        self.new_object_detail = ""

    def add_object_from_inputs(self):
        self.add_object(self.new_object_label, self.new_object_detail)

    def remove_object(self, label: str):
        self.context.objects = [x for x in self.context.objects if x.label != label]

    def clear_context(self):
        self.context = ContextState()

    def _context_payload(self) -> dict:
        return {
            "summary": self.context.summary,
            "npcs": [{"label": it.label, "detail": it.detail} for it in self.context.npcs],
            "objects": [{"label": it.label, "detail": it.detail} for it in self.context.objects],
        }

    async def suggest_context(self):
        if not self.draft_text.strip():
            return
        payload = {"current_text": self.draft_text, "model": self.model, "max_npcs": 6, "max_objects": 8}
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{API_BASE}/api/suggest-context", json=payload)
            r.raise_for_status()
            data = r.json()
        # Map JSON to ContextState
        npcs = [ContextItem(**x) for x in data.get("npcs", [])]
        objs = [ContextItem(**x) for x in data.get("objects", [])]
        self.context = ContextState(summary=data.get("summary", ""), npcs=npcs, objects=objs)
        await self.save_state()

    async def do_continue(self):
        # Compose draft text from current branch + pending new chunk text.
        base_text = self.joined_chunks_text or "\n\n".join([s.content for s in self.branch_path])
        extra = (self.new_chunk_text or "").strip()
        draft_text = base_text if not extra else (base_text + ("\n\n" if base_text else "") + extra)
        if not draft_text.strip():
            return
        self.status = "thinking"
        # Update local snapshot and (optionally) extract memory on composed draft text.
        self.draft_text = draft_text
        if self.include_memory:
            await self.extract_memory()
        payload = {
            "draft_text": draft_text,
            "instruction": self.instruction,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "model": self.model,
            "use_memory": self.include_memory,
            "use_context": self.include_context,
            "story": self.current_story,
            "system_prompt": self.system_prompt,
            "lore_ids": list(self.selected_lore_ids),
            # Generate without persisting; show result in composer
            "preview_only": True,
        }
        if self.include_context:
            payload["context"] = self._context_payload()
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(f"{API_BASE}/api/continue", json=payload)
                r.raise_for_status()
                data = r.json()
            # Place the generated continuation into the composer area without persisting
            cont = (data or {}).get("continuation", "")
            if cont:
                # Append with spacing if user already wrote something
                existing = (self.new_chunk_text or "").rstrip()
                self.new_chunk_text = (existing + ("\n\n" if existing else "") + cont).strip()
            self.status = "done"
            await self.save_state()
        except Exception as e:
            self.status = f"error: {e}"

    async def submit_new_lore(self):
        name = (self.new_lore_name or "").strip()
        kind = (self.new_lore_kind or "").strip()
        summary = (self.new_lore_summary or "").strip()
        if not name or not kind or not summary:
            return
        await self.add_lore(name, kind, summary)
        self.new_lore_name = ""
        self.new_lore_kind = ""
        self.new_lore_summary = ""

    # Lore selection for generation
    def toggle_lore_selection(self, entry_id: str):
        s = set(self.selected_lore_ids)
        if entry_id in s:
            s.remove(entry_id)
        else:
            s.add(entry_id)
        self.selected_lore_ids = list(s)

    def set_system_prompt(self, value: str):
        self.system_prompt = value
