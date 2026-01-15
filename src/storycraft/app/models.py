from __future__ import annotations

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator
from typing import Literal


class GalleryItem(BaseModel):
    """Gallery image - either URL or uploaded file"""
    type: Literal["url", "upload"] = "url"
    value: str  # URL or filename
    display_name: str | None = None
    uploaded_at: datetime | None = None


class LoreEntry(BaseModel):
    id: str
    story: str
    name: str
    kind: str = Field(description="e.g., character, location, item, faction")
    summary: str
    tags: List[str] = Field(default_factory=list)
    # New: keyword triggers for auto-inclusion; case-insensitive substring match.
    keys: List[str] = Field(default_factory=list)
    # New: always include this entry in prompts when true.
    always_on: bool = False


class LoreEntryCreate(BaseModel):
    story: str
    name: str
    kind: str
    summary: str
    tags: List[str] = Field(default_factory=list)
    keys: List[str] = Field(default_factory=list)
    always_on: bool = False


class LoreEntryUpdate(BaseModel):
    # story is immutable once created; do not allow update to move entries across stories
    name: Optional[str] = None
    kind: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    keys: Optional[List[str]] = None
    always_on: Optional[bool] = None


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
    system_prompt: Optional[str] = None


class EditorCandidateScore(BaseModel):
    candidate: int
    instruction_coverage: Optional[float] = None
    continuity: Optional[float] = None
    quality: Optional[float] = None
    notes: Optional[str] = None

    @field_validator("candidate")
    @classmethod
    def candidate_non_negative(cls, value: int) -> int:
        return max(0, value)


class InternalEditorSelection(BaseModel):
    winner: int
    reason: Optional[str] = None
    scores: List[EditorCandidateScore] = Field(default_factory=list)

    @field_validator("winner")
    @classmethod
    def winner_non_negative(cls, value: int) -> int:
        return max(0, value)

    @model_validator(mode="after")
    def clamp_winner(self, info: ValidationInfo) -> "InternalEditorSelection":
        limit = info.context.get("num_candidates")
        if isinstance(limit, int) and limit > 0 and self.winner >= limit:
            self.winner = max(0, limit - 1)
        return self


class LoreEntryDraft(BaseModel):
    name: str
    kind: str = "note"
    summary: str
    tags: List[str] = Field(default_factory=list)
    keys: List[str] = Field(default_factory=list)
    always_on: bool = False


class SuggestContextResponse(ContextState):
    system_prompt: str = Field(
        default="",
        description="System prompt used when generating context suggestions.",
    )


class ContinueRequest(BaseModel):
    draft_text: str
    instruction: str = ""
    max_tokens: int = 1024
    model: Optional[str] = None
    use_memory: bool = True
    temperature: float = 1.0
    # Optional override of the system prompt used for generation.
    system_prompt: Optional[str] = None
    # Optional user/LLM-provided context to enrich the prompt.
    context: Optional[ContextState] = None
    use_context: bool = True
    # Optional story id for persistence/branching.
    story: Optional[str] = None
    # Optional lorebook items to include (IDs from lorebook)
    lore_ids: Optional[List[str]] = None
    # When true, do not persist generated continuation even if story is provided.
    preview_only: bool = False
    # Optional: client-specified context window; server truncates to 3x this (chars)
    max_context_window: Optional[int] = None


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
    temperature: float = 1.0
    max_tokens: int = 1024
    system_prompt: Optional[str] = None
    include_memory: bool = True
    include_context: bool = True
    context: Optional[ContextState] = None
    generations: List[str] = Field(default_factory=list)
    gen_index: int = -1


class ExperimentalFeatures(BaseModel):
    internal_editor_workflow: bool = False


class StorySettings(BaseModel):
    story: str
    temperature: float | None = None
    max_tokens: int | None = None
    model: str | None = None
    system_prompt: str | None = None
    # New: default/base instruction merged with user instruction for continuations
    base_instruction: str | None = None
    # Maximum context window (characters ÷ 3 heuristic used elsewhere)
    max_context_window: int | None = None
    context: ContextState | None = None
    gallery: list[GalleryItem] = Field(default_factory=list)
    synopsis: str | None = None
    memory: MemoryState | None = None
    experimental: Optional["ExperimentalFeatures"] = None
    initial_prompt: str | None = None  # Original story seed prompt

    @field_validator("gallery", mode="before")
    @classmethod
    def migrate_legacy_gallery(cls, value):
        """Convert legacy URL strings to GalleryItem objects"""
        if not value:
            return []
        result = []
        for item in value:
            if isinstance(item, str):
                result.append(GalleryItem(type="url", value=item))
            elif isinstance(item, dict):
                result.append(GalleryItem(**item))
            elif isinstance(item, GalleryItem):
                result.append(item)
        return result


class StorySettingsUpdate(BaseModel):
    story: str
    temperature: float | None = None
    max_tokens: int | None = None
    model: str | None = None
    system_prompt: str | None = None
    base_instruction: str | None = None
    max_context_window: int | None = None
    context: ContextState | None = None
    gallery: list[GalleryItem] | None = None
    synopsis: str | None = None
    memory: MemoryState | None = None
    experimental: Optional["ExperimentalFeatures"] = None
    initial_prompt: str | None = None


class StorySettingsPatch(StorySettingsUpdate):
    # Optional: replace lorebook snapshot when provided
    # Accept raw dicts to avoid requiring IDs when replacing the snapshot.
    lorebook: list[dict] | None = None


class TruncateStoryResponse(BaseModel):
    ok: bool = True
    root_snippet: Snippet


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
    # Optional branch name to update head for (defaults to 'main')
    branch: Optional[str] = None


class RegenerateSnippetRequest(BaseModel):
    story: str
    target_snippet_id: str
    content: str
    kind: str = "ai"
    set_active: bool = True
    branch: Optional[str] = None


class ChooseActiveChildRequest(BaseModel):
    story: str
    parent_id: str
    child_id: str
    branch: Optional[str] = None


class BranchPathResponse(BaseModel):
    story: str
    head_id: Optional[str]
    path: List[Snippet] = Field(default_factory=list)
    text: str = ""


class RegenerateAIRequest(BaseModel):
    story: str
    target_snippet_id: str
    instruction: str = ""
    max_tokens: int = 1024
    model: Optional[str] = None
    use_memory: bool = True
    temperature: float = 1.0
    max_context_window: Optional[int] = None
    context: Optional[ContextState] = None
    use_context: bool = True
    set_active: bool = True
    # Optional lorebook items to include (IDs from lorebook)
    lore_ids: Optional[List[str]] = None
    # Optional branch to update head for (defaults to 'main')
    branch: Optional[str] = None


class UpdateSnippetRequest(BaseModel):
    content: Optional[str] = None
    kind: Optional[str] = None


class InsertAboveRequest(BaseModel):
    story: str
    target_snippet_id: str
    content: str
    kind: str = "user"
    set_active: bool = True
    branch: Optional[str] = None


class InsertBelowRequest(BaseModel):
    story: str
    parent_snippet_id: str
    content: str
    kind: str = "user"
    set_active: bool = True
    branch: Optional[str] = None


class DeleteSnippetResponse(BaseModel):
    ok: bool = True


class TreeRow(BaseModel):
    parent: Snippet
    children: list[Snippet] = Field(default_factory=list)


# --- Story management ---

class DuplicateStoryRequest(BaseModel):
    source: str
    target: str
    mode: Literal['main', 'all'] = 'all'


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


# --- Prompt Preview ---

class PromptMessage(BaseModel):
    role: str
    content: str


class PromptPreviewRequest(BaseModel):
    draft_text: str = ""
    instruction: str = ""
    model: Optional[str] = None
    use_memory: bool = True
    use_context: bool = True
    story: Optional[str] = None
    lore_ids: Optional[List[str]] = None
    system_prompt: Optional[str] = None
    context: Optional[ContextState] = None


class PromptPreviewResponse(BaseModel):
    messages: List[PromptMessage] = Field(default_factory=list)


# --- Samples / Import ---
class DevSeedRequest(BaseModel):
    story: str
    chunks_filename: Optional[str] = None  # e.g., test_story_1.txt; defaults to <slug>.txt
    lore_filename: Optional[str] = None    # e.g., test_story_1_lore.json; optional
    split_paragraphs: bool = True
    clear_existing: bool = True
    purge: bool = False


class DevSeedResponse(BaseModel):
    story: str
    chunks_imported: int = 0
    lore_imported: int = 0


# --- Story Seeding (AI) ---
class SeedStoryRequest(BaseModel):
    story: str
    prompt: str
    model: Optional[str] = None
    temperature: float = 1.0
    max_tokens_first_chunk: int = 2048
    # When true, attempt to pick relevant lore entries by keyword match.
    use_lore: bool = True


class ProposedLoreEntry(BaseModel):
    name: str
    kind: str  # character, location, faction, item, concept
    reason: str  # 1-sentence explanation of importance


class SeedStoryResponse(BaseModel):
    story: str
    root_snippet_id: str
    content: str
    synopsis: str = ""
    relevant_lore_ids: list[str] = Field(default_factory=list)
    proposed_entities: list["ProposedLoreEntry"] = Field(default_factory=list)


# --- Lorebook Generation ---
class LoreGenerateRequest(BaseModel):
    story: str
    model: Optional[str] = None
    max_items: int = 20
    strategy: str = Field(default="append", description="append | replace")
    # Optional: when provided, generate details for these entry names.
    names: Optional[List[str]] = None


class LoreGenerateResponse(BaseModel):
    story: str
    created: int = 0
    total: int = 0


class ProposeLoreEntriesRequest(BaseModel):
    story: str
    story_text: str
    model: Optional[str] = None
    max_proposals: int = 8  # Fewer than current 10


class ProposeLoreEntriesResponse(BaseModel):
    story: str
    proposals: list[ProposedLoreEntry] = Field(default_factory=list)


class GenerateFromProposalsRequest(BaseModel):
    story: str
    story_text: str
    selected_names: list[str]  # User-confirmed names
    model: Optional[str] = None


# --- Story Import ---
class ImportStoryRequest(BaseModel):
    story: str
    text: str
    model: Optional[str] = None  # For lorebook proposal
    target_chunk_tokens: int = 768  # Target tokens per chunk (512-1024 range)
    generate_lore_proposals: bool = True


class ImportStoryResponse(BaseModel):
    story: str
    chunks_created: int = 0
    total_characters: int = 0
    proposed_entities: list["ProposedLoreEntry"] = Field(default_factory=list)
