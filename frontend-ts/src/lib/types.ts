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

export interface AppState {
  currentStory: string;
  instruction: string;
  chunks: Chunk[];
  history: HistoryEntry[];
  editingId: string | null;
  editingText: string;
  hoveredId: string | null;
  isGenerating: boolean;
  generationSettings: GenerationSettings;
  synopsis: string;
  lorebook: LoreEntry[];
  memory: MemoryState;
  context: ContextState;
  branches: BranchInfo[];
  treeRows: TreeRow[];
}