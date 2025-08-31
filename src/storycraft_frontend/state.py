from __future__ import annotations

import reflex as rx
import httpx


API_BASE = "http://127.0.0.1:8000"


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
    name: str
    kind: str
    summary: str
    tags: list[str] = []


class ContextItem(rx.Base):
    label: str
    detail: str


class ContextState(rx.Base):
    summary: str = ""
    npcs: list[ContextItem] = []
    objects: list[ContextItem] = []


class AppState(rx.State):
    draft_text: str = ""
    instruction: str = ""
    continuation: str = ""
    status: str = "idle"
    model: str = "openrouter/auto"
    temperature: float = 0.7
    max_tokens: int = 512

    lore: list[LoreEntry] = []
    memory: MemoryState = MemoryState()
    context: ContextState = ContextState()
    include_context: bool = True

    # Generation history for undo/redo
    generations: list[str] = []
    gen_index: int = -1  # -1 means no generations applied
    can_undo: bool = False
    can_redo: bool = False

    # Controlled inputs for new lore entry (avoid deprecated refs API).
    new_lore_name: str = ""
    new_lore_kind: str = ""
    new_lore_summary: str = ""

    # Controlled inputs for context item creation
    new_npc_label: str = ""
    new_npc_detail: str = ""
    new_object_label: str = ""
    new_object_detail: str = ""

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

    async def load_lore(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{API_BASE}/api/lorebook")
            r.raise_for_status()
            data = r.json()
        self.lore = [LoreEntry(**x) for x in data]

    async def load_state(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{API_BASE}/api/state")
            r.raise_for_status()
            data = r.json()
        # Map to current state (with defaults)
        self.draft_text = data.get("draft_text", self.draft_text)
        self.instruction = data.get("instruction", self.instruction)
        self.model = data.get("model", self.model)
        self.temperature = float(data.get("temperature", self.temperature))
        self.max_tokens = int(data.get("max_tokens", self.max_tokens))
        self.include_context = bool(data.get("include_context", self.include_context))
        ctx = data.get("context") or {}
        self.context = ContextState(
            summary=ctx.get("summary", ""),
            npcs=[ContextItem(**x) for x in ctx.get("npcs", [])],
            objects=[ContextItem(**x) for x in ctx.get("objects", [])],
        )
        self.generations = [str(x) for x in data.get("generations", [])]
        self.gen_index = int(data.get("gen_index", -1))
        self._update_undo_redo_flags()

    async def save_state(self):
        payload = {
            "draft_text": self.draft_text,
            "instruction": self.instruction,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "include_context": self.include_context,
            "context": self._context_payload(),
            "generations": self.generations,
            "gen_index": self.gen_index,
        }
        async with httpx.AsyncClient() as client:
            r = await client.put(f"{API_BASE}/api/state", json=payload)
            r.raise_for_status()

    def _update_undo_redo_flags(self):
        self.can_undo = self.gen_index >= 0
        self.can_redo = self.gen_index < len(self.generations) - 1

    async def add_lore(self, name: str, kind: str, summary: str):
        payload = {"name": name, "kind": kind, "summary": summary, "tags": []}
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{API_BASE}/api/lorebook", json=payload)
            r.raise_for_status()
            data = r.json()
        self.lore.append(LoreEntry(**data))

    async def delete_lore(self, entry_id: str):
        async with httpx.AsyncClient() as client:
            r = await client.delete(f"{API_BASE}/api/lorebook/{entry_id}")
            r.raise_for_status()
        self.lore = [x for x in self.lore if x.id != entry_id]

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
        if not self.draft_text.strip():
            return
        self.status = "thinking"
        await self.extract_memory()
        payload = {
            "draft_text": self.draft_text,
            "instruction": self.instruction,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "model": self.model,
            "use_memory": True,
            "use_context": self.include_context,
        }
        if self.include_context:
            payload["context"] = self._context_payload()
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(f"{API_BASE}/api/continue", json=payload)
                r.raise_for_status()
                data = r.json()
            self.continuation = data.get("continuation", "")
            # Apply continuation to draft and push to history
            self._push_generation(self.continuation)
            self.status = "done"
            await self.save_state()
        except Exception as e:
            self.status = f"error: {e}"

    def _append_to_draft(self, text: str):
        if not text:
            return
        if not self.draft_text:
            self.draft_text = text
            return
        # Ensure a separating newline if needed
        sep = "\n\n" if not self.draft_text.endswith("\n") and not text.startswith("\n") else ""
        self.draft_text = f"{self.draft_text}{sep}{text}"

    def _push_generation(self, text: str):
        # Truncate redo tail if any
        if self.gen_index < len(self.generations) - 1:
            self.generations = self.generations[: self.gen_index + 1]
        self.generations.append(text)
        self.gen_index += 1
        self._append_to_draft(text)
        self._update_undo_redo_flags()

    async def undo_generation(self):
        if self.gen_index < 0:
            return
        seg = self.generations[self.gen_index]
        if seg and self.draft_text.endswith(seg):
            self.draft_text = self.draft_text[: -len(seg)]
        else:
            # Best-effort: try trimming if segment exactly at end
            pos = self.draft_text.rfind(seg)
            if pos != -1 and pos + len(seg) == len(self.draft_text):
                self.draft_text = self.draft_text[:pos]
        self.gen_index -= 1
        self._update_undo_redo_flags()
        await self.save_state()

    async def redo_generation(self):
        if self.gen_index >= len(self.generations) - 1:
            return
        self.gen_index += 1
        seg = self.generations[self.gen_index]
        self._append_to_draft(seg)
        self._update_undo_redo_flags()
        await self.save_state()

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
