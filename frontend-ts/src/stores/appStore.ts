import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { 
  Chunk, 
  HistoryEntry, 
  GenerationSettings, 
  LoreEntry, 
  MemoryState,
  ContextState,
  BranchInfo,
  TreeRow,
  AppState as AppStateType
} from '@/lib/types'
import { uid } from '@/lib/utils'

interface AppState extends AppStateType {
  // Actions
  setCurrentStory: (story: string) => void
  setInstruction: (instruction: string) => void
  setChunks: (chunks: Chunk[]) => void
  addChunk: (chunk: Chunk) => void
  updateChunk: (id: string, updates: Partial<Chunk>) => void
  deleteChunk: (id: string) => void
  setEditingId: (id: string | null) => void
  setEditingText: (text: string) => void
  setHoveredId: (id: string | null) => void
  setIsGenerating: (isGenerating: boolean) => void
  updateGenerationSettings: (settings: Partial<GenerationSettings>) => void
  setSynopsis: (synopsis: string) => void
  setLorebook: (lorebook: LoreEntry[]) => void
  setMemory: (memory: MemoryState) => void
  setContext: (context: ContextState) => void
  setBranches: (branches: BranchInfo[]) => void
  setTreeRows: (treeRows: TreeRow[]) => void
  pushHistory: (action: HistoryEntry['action'], before: Chunk[], after: Chunk[]) => void
  revertFromHistory: () => void
  clearHistory: () => void
}

const initialState = {
  currentStory: 'default',
  instruction: 'Continue the story, matching established voice, tone, and point of view. Maintain continuity with prior events and details.',
  chunks: [],
  history: [],
  editingId: null,
  editingText: '',
  hoveredId: null,
  isGenerating: false,
  generationSettings: {
    temperature: 0.8,
    max_tokens: 256,
    model: undefined,
    system_prompt: undefined,
  },
  synopsis: "Mira, a courier in a rain-soaked coastal city, discovers a message that could end a quiet war.",
  lorebook: [
    {
      id: uid(),
      story: 'default',
      name: 'Mira',
      kind: 'character',
      summary: 'Protagonist. Courier with a strict moral code; hates lying.',
      tags: ['protagonist', 'courier'],
      keys: ['Mira'],
      always_on: true,
    },
    {
      id: uid(),
      story: 'default', 
      name: 'The Quiet War',
      kind: 'conflict',
      summary: 'Conflict fought with disinformation and blackmail; few know it exists.',
      tags: ['war', 'conflict'],
      keys: ['quiet war', 'war'],
      always_on: false,
    },
  ],
  memory: {
    characters: [],
    subplots: [],
    facts: [],
  },
  context: {
    summary: "",
    npcs: [],
    objects: [],
  },
  branches: [],
  treeRows: [],
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setCurrentStory: (story) => set({ currentStory: story }),
      
      setInstruction: (instruction) => set({ instruction }),
      
      setChunks: (chunks) => set({ chunks }),
      
      addChunk: (chunk) => set((state) => ({ chunks: [...state.chunks, chunk] })),
      
      updateChunk: (id, updates) => set((state) => ({
        chunks: state.chunks.map(chunk => 
          chunk.id === id ? { ...chunk, ...updates } : chunk
        )
      })),
      
      deleteChunk: (id) => set((state) => {
        const before = state.chunks
        const after = state.chunks.filter(chunk => chunk.id !== id)
        const newHistory = [...state.history, {
          id: uid(),
          action: 'delete' as const,
          before,
          after,
          at: Date.now(),
        }]
        return { chunks: after, history: newHistory }
      }),
      
      setEditingId: (editingId) => set({ editingId }),
      
      setEditingText: (editingText) => set({ editingText }),
      
      setHoveredId: (hoveredId) => set({ hoveredId }),
      
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      
      updateGenerationSettings: (settings) => set((state) => ({
        generationSettings: { ...state.generationSettings, ...settings }
      })),
      
      setSynopsis: (synopsis) => set({ synopsis }),
      
      setLorebook: (lorebook) => set({ lorebook }),
      
      setMemory: (memory) => set({ memory }),
      
      setContext: (context) => set({ context }),
      
      setBranches: (branches) => set({ branches }),
      
      setTreeRows: (treeRows) => set({ treeRows }),
      
      pushHistory: (action, before, after) => set((state) => ({
        history: [{
          id: uid(),
          action,
          before,
          after,
          at: Date.now(),
        }, ...state.history]
      })),
      
      revertFromHistory: () => set((state) => {
        if (state.history.length === 0) return state
        const [lastEntry, ...restHistory] = state.history
        return {
          chunks: lastEntry.before,
          history: restHistory,
        }
      }),
      
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'app-store' }
  )
)
