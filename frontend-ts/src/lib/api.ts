import axios from 'axios';
import type {
  LoreEntry,
  LoreEntryCreate,
  LoreEntryUpdate,
  MemoryState,
  BranchPathResponse,
  AppendSnippetRequest,
  RegenerateAIRequest,
  ContinueRequest,
  ContinueResponse,
  Snippet,
  ContextState,
  StorySettingsPayload,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_STORYCRAFT_API_BASE || 'http://localhost:8001';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
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

// Stories
export const getStories = async (): Promise<string[]> => {
  const response = await apiClient.get('/api/stories');
  return response.data;
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
  const response = await apiClient.post('/api/continue', request);
  return response.data;
};

// Snippets
export const getBranchPath = async (story: string): Promise<BranchPathResponse> => {
  const response = await apiClient.get('/api/snippets/path', {
    params: { story },
  });
  return response.data;
};

export const appendSnippet = async (request: AppendSnippetRequest): Promise<Snippet> => {
  const response = await apiClient.post('/api/snippets/append', request);
  return response.data;
};

export const regenerateSnippet = async (request: RegenerateAIRequest): Promise<Snippet> => {
  const response = await apiClient.post('/api/snippets/regenerate-ai', request);
  return response.data;
};

export const updateSnippet = async (
  id: string,
  update: { content?: string; kind?: string }
): Promise<Snippet> => {
  const response = await apiClient.put(`/api/snippets/${id}`, update);
  return response.data;
};

export const deleteSnippet = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/snippets/${id}`);
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

export const chooseActiveChild = async (story: string, parentId: string, childId: string) => {
  const response = await apiClient.post('/api/snippets/choose-active', {
    story,
    parent_id: parentId,
    child_id: childId,
  });
  return response.data;
};

// Prompt preview
export const getPromptPreview = async (
  story: string,
  instruction?: string,
  model?: string
) => {
  const response = await apiClient.post('/api/prompt-preview', {
    story,
    instruction,
    model,
  });
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

export const saveStorySettings = async (payload: StorySettingsPayload): Promise<void> => {
  try {
    await apiClient.put('/api/story-settings', payload);
  } catch (err: any) {
    // If endpoint missing, try legacy /api/state without story scoping
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
