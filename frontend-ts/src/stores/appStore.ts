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
  AppState as AppStateType,
  ExperimentalFeatures,
  GalleryItem,
  RPGModeSettings,
} from '@/lib/types'
import { uid } from '@/lib/utils'
import { saveQueue } from '@/lib/saveQueue'

interface AppState extends AppStateType {
  generationSettingsHydrated: boolean
  // Actions
  setCurrentStory: (story: string) => void
  setCurrentBranch: (name: string) => void
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
  setGenerationSettingsHydrated: (hydrated: boolean) => void
  setSynopsis: (synopsis: string) => void
  setLorebook: (lorebook: LoreEntry[]) => void
  setMemory: (memory: MemoryState) => void
  setContext: (context: ContextState) => void
  setBranches: (branches: BranchInfo[]) => void
  setTreeRows: (treeRows: TreeRow[]) => void
  pushHistory: (action: HistoryEntry['action'], before: Chunk[], after: Chunk[]) => void
  revertFromHistory: () => void
  clearHistory: () => void
  setExperimental: (experimental: ExperimentalFeatures) => void
  updateExperimental: (experimental: Partial<ExperimentalFeatures>) => void
  // Gallery
  setGallery: (items: GalleryItem[]) => void
  addGalleryImage: (item: GalleryItem) => void
  removeGalleryImage: (item: GalleryItem) => void
  // RPG Mode
  setRpgModeSettings: (settings: RPGModeSettings | undefined) => void
  updateRpgModeSettings: (settings: Partial<RPGModeSettings>) => void
}

const defaultExperimental: ExperimentalFeatures = {
  internal_editor_workflow: false,
  dark_mode: false,
}

const initialState = {
  currentStory: 'default',
  instruction: '',
  chunks: [],
  history: [],
  editingId: null,
  editingText: '',
  hoveredId: null,
  isGenerating: false,
  currentBranch: 'main',
  generationSettings: {
    temperature: 0.8,
    max_tokens: 256,
    model: undefined,
    system_prompt: undefined,
    max_context_window: 1000,
    base_instruction: 'Continue the story, matching established voice, tone, and point of view. Maintain continuity with prior events and details.',
  },
  generationSettingsHydrated: false,
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
    system_prompt: undefined,
  },
  branches: [],
  treeRows: [],
  gallery: [],
  experimental: { ...defaultExperimental },
  rpgModeSettings: undefined,
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setCurrentStory: (story) => {
        const currentStoryBefore = get().currentStory
        if (currentStoryBefore === story) return // No-op if same story

        // Flush previous story's pending edits with keepalive for reliability
        // This is fire-and-forget but uses keepalive to survive if user navigates away
        saveQueue.flush({ keepalive: true }).catch(() => {})

        // Set new story state synchronously (saveQueue operates on snippet IDs,
        // so clearing chunks doesn't lose queued data)
        set({
          currentStory: story,
          // Reset per-story draft data so sync adopts backend for the selected story
          chunks: [],
          history: [],
          editingId: null,
          editingText: '',
          hoveredId: null,
          generationSettingsHydrated: false,
          experimental: { ...defaultExperimental },
          rpgModeSettings: undefined,
        })
      },

      setInstruction: (instruction) => set({ instruction }),

      setCurrentBranch: (name: string) => {
        const currentBranchBefore = get().currentBranch
        if (currentBranchBefore === name) return // No-op if same branch

        // Flush pending edits with keepalive for reliability
        saveQueue.flush({ keepalive: true }).catch(() => {})

        // Update branch synchronously
        set({ currentBranch: name })
      },
      
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

      setGenerationSettingsHydrated: (hydrated) => set({ generationSettingsHydrated: hydrated }),
      
      setSynopsis: (synopsis) => set({ synopsis }),
      
      setLorebook: (lorebook) => set({ lorebook }),
      
      setMemory: (memory) => set({ memory }),
      
      setContext: (context) => set({ context }),
      
      setBranches: (branches) => set(() => {
        const seen = new Set<string>()
        const filtered = [] as BranchInfo[]
        for (const b of branches) {
          const name = (b.name || '').trim()
          if (seen.has(name)) continue
          seen.add(name)
          filtered.push(b)
        }
        return { branches: filtered }
      }),

      setTreeRows: (treeRows) => set({ treeRows }),

      setExperimental: (experimental) =>
        set({ experimental: experimental ? { ...defaultExperimental, ...experimental } : { ...defaultExperimental } }),

      updateExperimental: (experimental) => set((state) => ({
        experimental: { ...state.experimental, ...experimental },
      })),
      
      // Gallery actions
      setGallery: (gallery: GalleryItem[]) => set({ gallery }),
      addGalleryImage: (item: GalleryItem) => set((state) => ({ gallery: [item, ...state.gallery] })),
      removeGalleryImage: (item: GalleryItem) => set((state) => ({
        gallery: state.gallery.filter(i => !(i.type === item.type && i.value === item.value))
      })),

      // RPG Mode actions
      setRpgModeSettings: (rpgModeSettings: RPGModeSettings | undefined) => set({ rpgModeSettings }),
      updateRpgModeSettings: (settings: Partial<RPGModeSettings>) => set((state) => ({
        rpgModeSettings: state.rpgModeSettings
          ? { ...state.rpgModeSettings, ...settings }
          : undefined
      })),

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
