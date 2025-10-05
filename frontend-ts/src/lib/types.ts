export interface Chunk {
  id: string;
  text: string;
  author: "user" | "llm";
  timestamp: number;
}

export interface LoreEntry {
  id: string;
  story: string;
  name: string;
  kind: string;
  summary: string;
  tags: string[];
  keys: string[];
  always_on: boolean;
}

export interface LoreEntryCreate {
  story: string;
  name: string;
  kind: string;
  summary: string;
  tags?: string[];
  keys?: string[];
  always_on?: boolean;
}

export interface LoreEntryUpdate {
  name?: string;
  kind?: string;
  summary?: string;
  tags?: string[];
  keys?: string[];
  always_on?: boolean;
}

export interface MemoryItem {
  type: string;
  label: string;
  detail: string;
}

export interface MemoryState {
  characters: MemoryItem[];
  subplots: MemoryItem[];
  facts: MemoryItem[];
}

export interface ContextItem {
  label: string;
  detail: string;
}

export interface ContextState {
  summary: string;
  npcs: ContextItem[];
  objects: ContextItem[];
}

export interface Snippet {
  id: string;
  story: string;
  parent_id: string | null;
  child_id: string | null;
  kind: string;
  content: string;
  created_at: string;
}

export interface BranchPathResponse {
  story: string;
  head_id: string | null;
  path: Snippet[];
  text: string;
}

export interface AppendSnippetRequest {
  story: string;
  content: string;
  kind?: string;
  parent_id?: string | null;
  set_active?: boolean | null;
  branch?: string;
}

export interface InsertAboveRequest {
  story: string;
  target_snippet_id: string;
  content: string;
  kind?: string;
  set_active?: boolean;
  branch?: string;
}

export interface InsertBelowRequest {
  story: string;
  parent_snippet_id: string;
  content: string;
  kind?: string;
  set_active?: boolean;
  branch?: string;
}

export interface RegenerateAIRequest {
  story: string;
  target_snippet_id: string;
  instruction?: string;
  max_tokens?: number;
  model?: string | null;
  use_memory?: boolean;
  temperature?: number;
  context?: ContextState | null;
  use_context?: boolean;
  set_active?: boolean;
  lore_ids?: string[] | null;
  branch?: string;
  max_context_window?: number;
}

export interface ContinueRequest {
  draft_text: string;
  instruction?: string;
  max_tokens?: number;
  model?: string | null;
  use_memory?: boolean;
  temperature?: number;
  system_prompt?: string | null;
  context?: ContextState | null;
  use_context?: boolean;
  story?: string | null;
  lore_ids?: string[] | null;
  preview_only?: boolean;
}

export interface ContinueResponse {
  continuation: string;
  model: string;
}

// UI-specific types
export interface HistoryEntry {
  id: string;
  action: "generate" | "regenerate" | "revert" | "delete" | "branch" | "edit";
  before: Chunk[];
  after: Chunk[];
  at: number;
}

export interface GenerationSettings {
  temperature: number;
  max_tokens: number;
  model?: string;
  system_prompt?: string;
  max_context_window?: number; // custom: used to limit draft context (chars = 3x)
  base_instruction?: string;
}

export interface ExperimentalFeatures {
  internal_editor_workflow?: boolean;
}

export interface BranchInfo {
  story: string;
  name: string;
  head_id: string;
  created_at: string;
}

export interface TreeRow {
  parent: Snippet;
  children: Snippet[];
}

export interface TreeResponse {
  story: string;
  rows: TreeRow[];
}

export interface PromptMessage {
  role: string;
  content: string;
}

export interface PromptPreviewResponse {
  messages: PromptMessage[];
}

export interface PromptPreviewRequest {
  story?: string | null;
  draft_text?: string;
  instruction?: string;
  model?: string | null;
  use_memory?: boolean;
  use_context?: boolean;
  lore_ids?: string[] | null;
  system_prompt?: string | null;
  context?: ContextState | null;
}

export interface TruncateStoryResponse {
  ok: boolean;
  root_snippet: Snippet;
}

// --- AI Seed Story ---
export interface SeedStoryRequest {
  story: string;
  prompt: string;
  model?: string | null;
  temperature?: number;
  max_tokens_first_chunk?: number;
  use_lore?: boolean;
}

export interface SeedStoryResponse {
  story: string;
  root_snippet_id: string;
  content: string;
  synopsis: string;
  relevant_lore_ids: string[];
}

export interface LoreGenerateRequest {
  story: string;
  model?: string | null;
  max_items?: number;
  strategy?: 'append' | 'replace';
  names?: string[] | null;
}

export interface LoreGenerateResponse {
  story: string;
  created: number;
  total: number;
}

export interface AppState {
  currentStory: string;
  currentBranch: string;
  instruction: string;
  chunks: Chunk[];
  history: HistoryEntry[];
  editingId: string | null;
  editingText: string;
  hoveredId: string | null;
  isGenerating: boolean;
  generationSettings: GenerationSettings;
  // UI-only flag; not persisted to backend legacy state
  generationSettingsHydrated?: boolean;
  synopsis: string;
  lorebook: LoreEntry[];
  memory: MemoryState;
  context: ContextState;
  branches: BranchInfo[];
  treeRows: TreeRow[];
  gallery: string[];
  experimental: ExperimentalFeatures;
}

// Per-story settings payload persisted in backend
export interface StorySettingsPayload {
  story: string;
  temperature?: number;
  max_tokens?: number;
  model?: string | null;
  system_prompt?: string | null;
  base_instruction?: string | null;
  max_context_window?: number;
  context?: ContextState;
  gallery?: string[];
  // Optional future fields: synopsis, memory
  synopsis?: string;
  memory?: MemoryState;
  lorebook?: LoreEntry[];
  experimental?: ExperimentalFeatures;
}
