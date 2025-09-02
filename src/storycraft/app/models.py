from __future__ import annotations

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class LoreEntry(BaseModel):
    id: str
    name: str
    kind: str = Field(description="e.g., character, location, item, faction")
    summary: str
    tags: List[str] = Field(default_factory=list)


class LoreEntryCreate(BaseModel):
    name: str
    kind: str
    summary: str
    tags: List[str] = Field(default_factory=list)


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
    characters: List[MemoryItem] = Field(default_factory=list)
    subplots: List[MemoryItem] = Field(default_factory=list)
    facts: List[MemoryItem] = Field(default_factory=list)


class ContextItem(BaseModel):
    label: str
    detail: str


class ContextState(BaseModel):
    summary: str = ""
    npcs: List[ContextItem] = Field(default_factory=list)
    objects: List[ContextItem] = Field(default_factory=list)


class ContinueRequest(BaseModel):
    draft_text: str
    instruction: str = ""
    max_tokens: int = 512
    model: Optional[str] = None
    use_memory: bool = True
    temperature: float = 0.7
    # Optional user/LLM-provided context to enrich the prompt.
    context: Optional[ContextState] = None
    use_context: bool = True
    # Optional story id for persistence/branching.
    story: Optional[str] = None


class ContinueResponse(BaseModel):
    continuation: str
    model: str


class ExtractMemoryRequest(BaseModel):
    current_text: str
    max_items: int = 10
    model: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "ok"


class SuggestContextRequest(BaseModel):
    current_text: str
    model: Optional[str] = None
    max_npcs: int = 6
    max_objects: int = 8


class AppPersistedState(BaseModel):
    draft_text: str = ""
    instruction: str = ""
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 512
    include_context: bool = True
    context: Optional[ContextState] = None
    generations: List[str] = Field(default_factory=list)
    gen_index: int = -1


# --- Snippets & Branching ---

class Snippet(BaseModel):
    id: str
    story: str
    parent_id: Optional[str] = None
    child_id: Optional[str] = None
    kind: str = Field(description="e.g., user, ai")
    content: str
    created_at: datetime


class AppendSnippetRequest(BaseModel):
    story: str
    content: str
    kind: str = "ai"
    parent_id: Optional[str] = None
    # If None and parent has no active child, becomes active. If False, never active.
    set_active: Optional[bool] = None


class RegenerateSnippetRequest(BaseModel):
    story: str
    target_snippet_id: str
    content: str
    kind: str = "ai"
    set_active: bool = True


class ChooseActiveChildRequest(BaseModel):
    story: str
    parent_id: str
    child_id: str


class BranchPathResponse(BaseModel):
    story: str
    head_id: Optional[str]
    path: List[Snippet] = Field(default_factory=list)
    text: str = ""


class RegenerateAIRequest(BaseModel):
    story: str
    target_snippet_id: str
    instruction: str = ""
    max_tokens: int = 512
    model: Optional[str] = None
    use_memory: bool = True
    temperature: float = 0.7
    context: Optional[ContextState] = None
    use_context: bool = True
    set_active: bool = True


class UpdateSnippetRequest(BaseModel):
    content: Optional[str] = None
    kind: Optional[str] = None


class InsertAboveRequest(BaseModel):
    story: str
    target_snippet_id: str
    content: str
    kind: str = "user"
    set_active: bool = True


class InsertBelowRequest(BaseModel):
    story: str
    parent_snippet_id: str
    content: str
    kind: str = "user"
    set_active: bool = True


class DeleteSnippetResponse(BaseModel):
    ok: bool = True


class TreeRow(BaseModel):
    parent: Snippet
    children: list[Snippet] = Field(default_factory=list)


class TreeResponse(BaseModel):
    story: str
    rows: list[TreeRow] = Field(default_factory=list)


class BranchInfo(BaseModel):
    story: str
    name: str
    head_id: str
    created_at: datetime


class UpsertBranchRequest(BaseModel):
    story: str
    name: str
    head_id: str
