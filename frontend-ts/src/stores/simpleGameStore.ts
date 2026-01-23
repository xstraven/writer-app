import { create } from 'zustand';
import type {
  SimpleAttribute,
  SimplePlayer,
  SimpleGameAction,
  SimpleDiceResult,
  SimpleGameStatus,
} from '@/lib/types';

interface SimpleGameState {
  // Setup
  gameId: string;
  adventureName: string;
  worldSetting: string;
  attributes: SimpleAttribute[];

  // Players
  players: SimplePlayer[];
  currentPlayerIndex: number;

  // Game
  status: SimpleGameStatus;
  actionHistory: SimpleGameAction[];
  turnNumber: number;

  // UI
  isGenerating: boolean;
  suggestedActions: string[];
  lastDiceResult: SimpleDiceResult | null;

  // Actions - Setup
  setAdventure: (name: string, setting: string) => void;
  setAttributes: (attrs: SimpleAttribute[]) => void;

  // Actions - Players
  addPlayer: (player: SimplePlayer) => void;
  removePlayer: (id: string) => void;
  updatePlayer: (id: string, updates: Partial<SimplePlayer>) => void;

  // Actions - Game
  startGame: (openingScene: string, suggestions: string[]) => void;
  addAction: (action: SimpleGameAction) => void;
  nextTurn: () => void;
  advanceToPlayers: () => void;

  // Actions - UI
  setGenerating: (v: boolean) => void;
  setSuggestedActions: (actions: string[]) => void;
  setLastDiceResult: (result: SimpleDiceResult | null) => void;

  // Actions - Reset
  resetGame: () => void;

  // Getters
  getCurrentPlayer: () => SimplePlayer | null;
}

const generateGameId = () => crypto.randomUUID().slice(0, 8);

export const useSimpleGameStore = create<SimpleGameState>((set, get) => ({
  // Initial state
  gameId: generateGameId(),
  adventureName: '',
  worldSetting: '',
  attributes: [],
  players: [],
  currentPlayerIndex: 0,
  status: 'setup',
  actionHistory: [],
  turnNumber: 1,
  isGenerating: false,
  suggestedActions: [],
  lastDiceResult: null,

  // Setup actions
  setAdventure: (name, setting) => set({ adventureName: name, worldSetting: setting }),

  setAttributes: (attrs) => set({ attributes: attrs }),

  // Player actions
  addPlayer: (player) => set((state) => ({
    players: [...state.players, player],
  })),

  removePlayer: (id) => set((state) => ({
    players: state.players.filter((p) => p.id !== id),
  })),

  updatePlayer: (id, updates) => set((state) => ({
    players: state.players.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    ),
  })),

  // Game actions
  advanceToPlayers: () => set({ status: 'players' }),

  startGame: (openingScene, suggestions) => {
    const openingAction: SimpleGameAction = {
      id: crypto.randomUUID(),
      type: 'gm_narration',
      content: openingScene,
      timestamp: Date.now(),
    };
    set({
      status: 'active',
      actionHistory: [openingAction],
      suggestedActions: suggestions,
      currentPlayerIndex: 0,
      turnNumber: 1,
    });
  },

  addAction: (action) => set((state) => ({
    actionHistory: [...state.actionHistory, action],
  })),

  nextTurn: () => set((state) => {
    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const newTurn = nextIndex === 0 ? state.turnNumber + 1 : state.turnNumber;
    return {
      currentPlayerIndex: nextIndex,
      turnNumber: newTurn,
      lastDiceResult: null,
    };
  }),

  // UI actions
  setGenerating: (v) => set({ isGenerating: v }),

  setSuggestedActions: (actions) => set({ suggestedActions: actions }),

  setLastDiceResult: (result) => set({ lastDiceResult: result }),

  // Reset
  resetGame: () => set({
    gameId: generateGameId(),
    adventureName: '',
    worldSetting: '',
    attributes: [],
    players: [],
    currentPlayerIndex: 0,
    status: 'setup',
    actionHistory: [],
    turnNumber: 1,
    isGenerating: false,
    suggestedActions: [],
    lastDiceResult: null,
  }),

  // Getters
  getCurrentPlayer: () => {
    const { players, currentPlayerIndex } = get();
    return players[currentPlayerIndex] || null;
  },
}));
