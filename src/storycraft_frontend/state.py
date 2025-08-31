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

    # Controlled inputs for new lore entry (avoid deprecated refs API).
    new_lore_name: str = ""
    new_lore_kind: str = ""
    new_lore_summary: str = ""

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
        }
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(f"{API_BASE}/api/continue", json=payload)
                r.raise_for_status()
                data = r.json()
            self.continuation = data.get("continuation", "")
            self.status = "done"
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

