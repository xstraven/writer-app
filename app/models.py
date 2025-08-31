from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class LoreEntry(BaseModel):
    id: str
    name: str
    kind: str = Field(description="e.g., character, location, item, faction")
    summary: str
    tags: List[str] = []


class LoreEntryCreate(BaseModel):
    name: str
    kind: str
    summary: str
    tags: List[str] = []


class LoreEntryUpdate(BaseModel):
    name: Optional[str] = None
    kind: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None


class MemoryItem(BaseModel):
    type: str = Field(description="e.g., character, subplot, relationship, goal")
    label: str
    detail: str


class MemoryState(BaseModel):
    characters: List[MemoryItem] = []
    subplots: List[MemoryItem] = []
    facts: List[MemoryItem] = []


class ContinueRequest(BaseModel):
    draft_text: str
    instruction: str = ""
    max_tokens: int = 512
    model: Optional[str] = None
    use_memory: bool = True
    temperature: float = 0.7


class ContinueResponse(BaseModel):
    continuation: str
    model: str


class ExtractMemoryRequest(BaseModel):
    current_text: str
    max_items: int = 10
    model: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "ok"

