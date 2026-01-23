import axios from 'axios';
import type {
  LoreEntry,
  LoreEntryCreate,
  LoreEntryUpdate,
  MemoryState,
  BranchPathResponse,
  AppendSnippetRequest,
  InsertAboveRequest,
  InsertBelowRequest,
  RegenerateAIRequest,
  ContinueRequest,
  ContinueResponse,
  Snippet,
  ContextState,
  StorySettingsPayload,
  SeedStoryRequest,
  SeedStoryResponse,
  LoreGenerateRequest,
  LoreGenerateResponse,
  ProposeLoreEntriesRequest,
  ProposeLoreEntriesResponse,
  GenerateFromProposalsRequest,
  PromptPreviewRequest,
  TruncateStoryResponse,
  ImportStoryRequest,
  ImportStoryResponse,
  RPGSetupRequest,
  RPGSetupResponse,
  RPGActionRequest,
  RPGActionResponse,
  RPGModeSettings,
  CharacterSheet,
  // Campaign types
  Campaign,
  CampaignWithPlayers,
  CreateCampaignRequest,
  CreateCampaignResponse,
  JoinCampaignRequest,
  JoinCampaignResponse,
  CampaignAction,
  CampaignActionRequest,
  CampaignActionResponse,
  TurnInfo,
  StartCampaignRequest,
  StartCampaignResponse,
  EndTurnRequest,
  Player,
  AddLocalPlayerRequest,
  AddLocalPlayerResponse,
} from './types';

export const API_BASE = process.env.NEXT_PUBLIC_STORYCRAFT_API_BASE || 'http://localhost:8000';

const GENERATION_TIMEOUT_MS = 120_000;

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  // Increase default timeout to accommodate LLM generation latency
  timeout: 30000, // 30 seconds
  withCredentials: false, // Disable credentials for CORS
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused - is the backend running on port 8001?');
    }
    return Promise.reject(error);
  }
);

// Health check
export const healthCheck = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

export const llmHealthCheck = async () => {
  const response = await apiClient.get('/health/llm');
  return response.data;
};

// Stories
export const getStories = async (): Promise<string[]> => {
  const response = await apiClient.get('/api/stories');
  return response.data;
};

export const deleteStory = async (story: string): Promise<void> => {
  await apiClient.delete(`/api/stories/${encodeURIComponent(story)}`)
};

export const duplicateStory = async (
  source: string,
  target: string,
  mode: 'main' | 'all' = 'all'
): Promise<void> => {
  await apiClient.post('/api/stories/duplicate', { source, target, mode })
};

// Lorebook
export const getLorebook = async (story?: string): Promise<LoreEntry[]> => {
  const params = story ? { story } : {};
  const response = await apiClient.get('/api/lorebook', { params });
  return response.data;
};

export const createLoreEntry = async (entry: LoreEntryCreate): Promise<LoreEntry> => {
  const response = await apiClient.post('/api/lorebook', entry);
  return response.data;
};

export const updateLoreEntry = async (id: string, entry: LoreEntryUpdate): Promise<LoreEntry> => {
  const response = await apiClient.put(`/api/lorebook/${id}`, entry);
  return response.data;
};

export const deleteLoreEntry = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/lorebook/${id}`);
};

// Memory
export const extractMemory = async (currentText: string, model?: string): Promise<MemoryState> => {
  const response = await apiClient.post('/api/extract-memory', {
    current_text: currentText,
    model,
  });
  return response.data;
};

// Story continuation
export const continueStory = async (request: ContinueRequest): Promise<ContinueResponse> => {
  const response = await apiClient.post('/api/continue', request, { timeout: GENERATION_TIMEOUT_MS });
  return response.data;
};

// Snippets
export const getBranchPath = async (
  story: string,
  opts?: { branch?: string; headId?: string }
): Promise<BranchPathResponse> => {
  const params: any = { story }
  if (opts?.headId) params.head_id = opts.headId
  if (opts?.branch) params.branch = opts.branch
  const response = await apiClient.get('/api/snippets/path', { params });
  return response.data;
};

export const appendSnippet = async (request: AppendSnippetRequest): Promise<Snippet> => {
  const response = await apiClient.post('/api/snippets/append', request);
  return response.data;
};

export const insertSnippetAbove = async (request: InsertAboveRequest): Promise<Snippet> => {
  const response = await apiClient.post('/api/snippets/insert-above', request)
  return response.data
}

export const insertSnippetBelow = async (request: InsertBelowRequest): Promise<Snippet> => {
  const response = await apiClient.post('/api/snippets/insert-below', request)
  return response.data
}

export const regenerateSnippet = async (request: RegenerateAIRequest): Promise<Snippet> => {
  const response = await apiClient.post('/api/snippets/regenerate-ai', request, { timeout: GENERATION_TIMEOUT_MS });
  return response.data;
};

export const updateSnippet = async (
  id: string,
  update: { content?: string; kind?: string }
): Promise<Snippet> => {
  const response = await apiClient.put(`/api/snippets/${id}`, update);
  return response.data;
};

export const deleteSnippet = async (id: string, story: string): Promise<void> => {
  await apiClient.delete(`/api/snippets/${id}`, { params: { story } });
};

export const getSnippetChildren = async (parentId: string, story: string): Promise<Snippet[]> => {
  const response = await apiClient.get(`/api/snippets/children/${parentId}`, {
    params: { story },
  });
  return response.data;
};

// State
export const saveAppState = async (state: any): Promise<void> => {
  await apiClient.put('/api/state', state);
};

export const loadAppState = async (): Promise<any> => {
  const response = await apiClient.get('/api/state');
  return response.data;
};

// Context suggestions
export const suggestContext = async (
  currentText: string,
  model?: string
): Promise<ContextState> => {
  const response = await apiClient.post('/api/suggest-context', {
    current_text: currentText,
    model,
  });
  return response.data;
};

// Branches
export const getBranches = async (story: string) => {
  const response = await apiClient.get('/api/branches', {
    params: { story },
  });
  return response.data;
};

export const createBranch = async (story: string, name: string, headId: string) => {
  const response = await apiClient.post('/api/branches', {
    story,
    name,
    head_id: headId,
  });
  return response.data;
};

export const deleteBranch = async (name: string, story: string) => {
  await apiClient.delete(`/api/branches/${name}`, {
    params: { story },
  });
};

// Tree operations
export const getTreeMain = async (story: string) => {
  const response = await apiClient.get('/api/snippets/tree-main', {
    params: { story },
  });
  return response.data;
};

export const chooseActiveChild = async (story: string, parentId: string, childId: string, branch?: string) => {
  const response = await apiClient.post('/api/snippets/choose-active', {
    story,
    parent_id: parentId,
    child_id: childId,
    branch,
  });
  return response.data;
};

// Prompt preview
export const getPromptPreview = async (payload: PromptPreviewRequest) => {
  const response = await apiClient.post('/api/prompt-preview', payload);
  return response.data;
};

export default apiClient;

// Per-story settings (gallery, context, generation params)
export const getStorySettings = async (story: string): Promise<StorySettingsPayload | null> => {
  try {
    const response = await apiClient.get('/api/story-settings', { params: { story } });
    return response.data;
  } catch (err: any) {
    // Fallback for older backends: return global state as a baseline
    if (err?.response?.status === 404) {
      try {
        const legacy = await loadAppState();
        return {
          story,
          temperature: legacy.temperature,
          max_tokens: legacy.max_tokens,
          model: legacy.model,
          system_prompt: legacy.system_prompt,
          context: legacy.context,
          gallery: [],
        } as StorySettingsPayload;
      } catch {
        return null;
      }
    }
    throw err;
  }
};

export const saveStorySettings = async (
  payload: StorySettingsPayload,
  opts?: { keepalive?: boolean }
): Promise<void> => {
  if (opts?.keepalive) {
    const url = `${API_BASE}/api/story-settings`
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      try {
        const blob = new Blob([body], { type: 'application/json' })
        const ok = (navigator as any).sendBeacon(url, blob)
        if (ok) {
          return
        }
        console.warn('Story settings sendBeacon returned false; falling back to keepalive fetch')
      } catch (err) {
        console.warn('Story settings sendBeacon failed', err)
      }
    }
    try {
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
      })
      return
    } catch (err) {
      console.warn('Story settings keepalive fetch failed', err)
    }
  }

  try {
    await apiClient.put('/api/story-settings', payload);
  } catch (err: any) {
    if (err?.response?.status === 404) {
      const legacy: any = {};
      if (payload.temperature !== undefined) legacy.temperature = payload.temperature;
      if (payload.max_tokens !== undefined) legacy.max_tokens = payload.max_tokens;
      if (payload.model !== undefined) legacy.model = payload.model;
      if (payload.system_prompt !== undefined) legacy.system_prompt = payload.system_prompt;
      if (payload.context !== undefined) legacy.context = payload.context;
      await saveAppState(legacy);
      return;
    }
    throw err;
  }
};

// AI seeding: create a new story from a prompt
export const seedStoryAI = async (payload: SeedStoryRequest): Promise<SeedStoryResponse> => {
  const response = await apiClient.post('/api/stories/seed-ai', payload, { timeout: GENERATION_TIMEOUT_MS })
  return response.data
}

// Import story from raw text
export const importStory = async (payload: ImportStoryRequest): Promise<ImportStoryResponse> => {
  const response = await apiClient.post('/api/stories/import', payload, { timeout: GENERATION_TIMEOUT_MS })
  return response.data
}

// Generate lorebook entries from current story text
export const generateLorebook = async (payload: LoreGenerateRequest): Promise<LoreGenerateResponse> => {
  const response = await apiClient.post('/api/lorebook/generate', payload, { timeout: GENERATION_TIMEOUT_MS })
  return response.data
}

// Propose lorebook entities without generating full entries
export const proposeLoreEntries = async (payload: ProposeLoreEntriesRequest): Promise<ProposeLoreEntriesResponse> => {
  const response = await apiClient.post('/api/lorebook/propose', payload, { timeout: GENERATION_TIMEOUT_MS })
  return response.data
}

// Generate lorebook entries from user-confirmed proposals
export const generateFromProposals = async (payload: GenerateFromProposalsRequest): Promise<LoreGenerateResponse> => {
  const response = await apiClient.post('/api/lorebook/generate-from-proposals', payload, { timeout: GENERATION_TIMEOUT_MS })
  return response.data
}

export const truncateStory = async (story: string): Promise<TruncateStoryResponse> => {
  const response = await apiClient.post(`/api/stories/${encodeURIComponent(story)}/truncate`)
  return response.data
}

// Gallery image upload/delete
export const uploadGalleryImage = async (
  story: string,
  file: File
): Promise<{ filename: string; url: string; original_filename: string }> => {
  const formData = new FormData();
  formData.append('story', story);
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/story-settings/upload-image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || 'Upload failed');
  }

  return response.json();
};

export const deleteGalleryImage = async (
  story: string,
  filename: string
): Promise<void> => {
  await apiClient.delete('/api/story-settings/delete-image', {
    params: { story, filename }
  });
};

// --- RPG Mode API ---

export const setupRPGSession = async (payload: RPGSetupRequest): Promise<RPGSetupResponse> => {
  const response = await apiClient.post('/api/rpg/setup', payload, { timeout: GENERATION_TIMEOUT_MS });
  return response.data;
};

export const performRPGAction = async (payload: RPGActionRequest): Promise<RPGActionResponse> => {
  const response = await apiClient.post('/api/rpg/action', payload, { timeout: GENERATION_TIMEOUT_MS });
  return response.data;
};

export const getRPGState = async (story: string): Promise<RPGModeSettings | null> => {
  try {
    const response = await apiClient.get('/api/rpg/state', { params: { story } });
    return response.data;
  } catch {
    return null;
  }
};

export const updateRPGCharacter = async (
  story: string,
  character: CharacterSheet
): Promise<{ ok: boolean; character: CharacterSheet }> => {
  const response = await apiClient.put('/api/rpg/character', character, {
    params: { story }
  });
  return response.data;
};

export const updateRPGSettings = async (
  story: string,
  updates: Partial<RPGModeSettings>
): Promise<{ ok: boolean }> => {
  const response = await apiClient.put('/api/rpg/settings', updates, {
    params: { story }
  });
  return response.data;
};

// --- Group RPG Campaign API ---

// Helper to get session token from localStorage
const getSessionToken = (): string => {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem('rpg_session_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('rpg_session_token', token);
  }
  return token;
};

// Create axios config with session token header
const withSessionToken = () => ({
  headers: { 'X-Session-Token': getSessionToken() },
});

export const listCampaigns = async (): Promise<CampaignWithPlayers[]> => {
  const response = await apiClient.get('/api/campaigns', withSessionToken());
  return response.data;
};

export const createCampaign = async (payload: CreateCampaignRequest): Promise<CreateCampaignResponse> => {
  const response = await apiClient.post('/api/campaigns', payload, {
    ...withSessionToken(),
    timeout: GENERATION_TIMEOUT_MS,
  });
  return response.data;
};

export const getCampaign = async (campaignId: string): Promise<CampaignWithPlayers> => {
  const response = await apiClient.get(`/api/campaigns/${campaignId}`, withSessionToken());
  return response.data;
};

export const deleteCampaign = async (campaignId: string): Promise<void> => {
  await apiClient.delete(`/api/campaigns/${campaignId}`, withSessionToken());
};

export const joinCampaign = async (payload: JoinCampaignRequest): Promise<JoinCampaignResponse> => {
  const response = await apiClient.post('/api/campaigns/join', payload, {
    ...withSessionToken(),
    timeout: GENERATION_TIMEOUT_MS,
  });
  return response.data;
};

export const startCampaign = async (
  campaignId: string,
  payload: StartCampaignRequest
): Promise<StartCampaignResponse> => {
  const response = await apiClient.post(`/api/campaigns/${campaignId}/start`, payload, {
    ...withSessionToken(),
    timeout: GENERATION_TIMEOUT_MS,
  });
  return response.data;
};

export const getCampaignPlayers = async (campaignId: string): Promise<Player[]> => {
  const response = await apiClient.get(`/api/campaigns/${campaignId}/players`, withSessionToken());
  return response.data;
};

export const leaveCampaign = async (campaignId: string, playerId: string): Promise<void> => {
  await apiClient.delete(`/api/campaigns/${campaignId}/players/${playerId}`, withSessionToken());
};

export const addLocalPlayer = async (
  campaignId: string,
  payload: AddLocalPlayerRequest
): Promise<AddLocalPlayerResponse> => {
  const response = await apiClient.post(`/api/campaigns/${campaignId}/players`, payload, {
    ...withSessionToken(),
    timeout: GENERATION_TIMEOUT_MS,
  });
  return response.data;
};

// Turn management
export const getTurnInfo = async (campaignId: string): Promise<TurnInfo> => {
  const response = await apiClient.get(`/api/campaigns/${campaignId}/turn`, withSessionToken());
  return response.data;
};

export const getActionHistory = async (campaignId: string, limit?: number): Promise<CampaignAction[]> => {
  const params = limit ? { limit } : {};
  const response = await apiClient.get(`/api/campaigns/${campaignId}/history`, {
    ...withSessionToken(),
    params,
  });
  return response.data;
};

export const takeCampaignAction = async (
  campaignId: string,
  payload: CampaignActionRequest
): Promise<CampaignActionResponse> => {
  const response = await apiClient.post(`/api/campaigns/${campaignId}/action`, payload, {
    ...withSessionToken(),
    timeout: GENERATION_TIMEOUT_MS,
  });
  return response.data;
};

export const endTurn = async (campaignId: string, payload: EndTurnRequest): Promise<TurnInfo> => {
  const response = await apiClient.post(`/api/campaigns/${campaignId}/end-turn`, payload, withSessionToken());
  return response.data;
};

// --- Simple RPG API (frontend-only game state) ---

import type {
  SimpleAttribute,
  SimplePlayer,
  SimpleGameAction,
  SimpleDiceResult,
} from './types';

export interface GenerateAttributesResponse {
  attributes: SimpleAttribute[];
}

export interface GenerateOpeningResponse {
  opening_scene: string;
  suggested_actions: string[];
}

export interface ResolveActionResponse {
  narrative: string;
  dice_result?: {
    attribute_used: string | null;
    modifier: number;
    roll: number;
    total: number;
    outcome: 'full_success' | 'partial_success' | 'miss';
  };
  suggested_actions: string[];
}

export const generateSimpleAttributes = async (
  worldSetting: string,
  model?: string
): Promise<GenerateAttributesResponse> => {
  const response = await apiClient.post('/api/simple-rpg/generate-attributes', {
    world_setting: worldSetting,
    model,
  }, { timeout: GENERATION_TIMEOUT_MS });
  return response.data;
};

export const generateSimpleOpening = async (
  worldSetting: string,
  players: SimplePlayer[],
  model?: string
): Promise<GenerateOpeningResponse> => {
  // Convert frontend player format to API format
  const apiPlayers = players.map(p => ({
    id: p.id,
    player_name: p.playerName,
    character_name: p.characterName,
    concept: p.concept,
    attribute_scores: p.attributeScores,
  }));

  const response = await apiClient.post('/api/simple-rpg/generate-opening', {
    world_setting: worldSetting,
    players: apiPlayers,
    model,
  }, { timeout: GENERATION_TIMEOUT_MS });
  return response.data;
};

export const resolveSimpleAction = async (
  worldSetting: string,
  actionHistory: SimpleGameAction[],
  player: SimplePlayer,
  action: string,
  allPlayers: SimplePlayer[],
  model?: string
): Promise<ResolveActionResponse> => {
  // Convert to API format
  const apiHistory = actionHistory.slice(-20).map(a => ({
    id: a.id,
    type: a.type,
    player_id: a.playerId,
    player_name: a.playerName,
    content: a.content,
  }));

  const apiPlayer = {
    id: player.id,
    player_name: player.playerName,
    character_name: player.characterName,
    concept: player.concept,
    attribute_scores: player.attributeScores,
  };

  const apiAllPlayers = allPlayers.map(p => ({
    id: p.id,
    player_name: p.playerName,
    character_name: p.characterName,
    concept: p.concept,
    attribute_scores: p.attributeScores,
  }));

  const response = await apiClient.post('/api/simple-rpg/resolve-action', {
    world_setting: worldSetting,
    action_history: apiHistory,
    player: apiPlayer,
    action,
    all_players: apiAllPlayers,
    model,
  }, { timeout: GENERATION_TIMEOUT_MS });
  return response.data;
};
