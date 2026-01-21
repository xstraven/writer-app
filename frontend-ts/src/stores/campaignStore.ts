import { create } from 'zustand';
import type {
  Campaign,
  CampaignWithPlayers,
  Player,
  CampaignAction,
  RPGActionResult,
  TurnInfo,
} from '@/lib/types';

interface CampaignState {
  // Session
  sessionToken: string | null;
  playerName: string;

  // Campaigns list (for lobby)
  campaigns: CampaignWithPlayers[];
  isLoadingCampaigns: boolean;

  // Current campaign
  currentCampaign: Campaign | null;
  currentPlayer: Player | null;
  allPlayers: Player[];

  // Game state
  actionHistory: CampaignAction[];
  isMyTurn: boolean;
  turnNumber: number;
  currentTurnPlayerId: string | null;
  currentTurnPlayerName: string | null;

  // UI state
  isPerformingAction: boolean;
  isLoadingHistory: boolean;
  lastDiceResults: RPGActionResult[];
  suggestedActions: string[];

  // Actions - Session
  initSession: () => void;
  setPlayerName: (name: string) => void;

  // Actions - Campaign List
  setCampaigns: (campaigns: CampaignWithPlayers[]) => void;
  setIsLoadingCampaigns: (loading: boolean) => void;
  addCampaign: (campaign: CampaignWithPlayers) => void;
  removeCampaign: (campaignId: string) => void;

  // Actions - Current Campaign
  setCurrentCampaign: (campaign: Campaign | null) => void;
  setCurrentPlayer: (player: Player | null) => void;
  setAllPlayers: (players: Player[]) => void;
  updateCampaign: (updates: Partial<Campaign>) => void;

  // Actions - Game State
  setActionHistory: (actions: CampaignAction[]) => void;
  addAction: (action: CampaignAction) => void;
  setIsLoadingHistory: (loading: boolean) => void;

  // Actions - Turn
  updateTurn: (turnInfo: TurnInfo) => void;
  setIsMyTurn: (isMyTurn: boolean) => void;

  // Actions - UI
  setIsPerformingAction: (performing: boolean) => void;
  setLastDiceResults: (results: RPGActionResult[]) => void;
  setSuggestedActions: (actions: string[]) => void;

  // Actions - Reset
  resetCurrentCampaign: () => void;
  resetAll: () => void;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  // Initial state
  sessionToken: null,
  playerName: '',
  campaigns: [],
  isLoadingCampaigns: false,
  currentCampaign: null,
  currentPlayer: null,
  allPlayers: [],
  actionHistory: [],
  isMyTurn: false,
  turnNumber: 0,
  currentTurnPlayerId: null,
  currentTurnPlayerName: null,
  isPerformingAction: false,
  isLoadingHistory: false,
  lastDiceResults: [],
  suggestedActions: [],

  // Session actions
  initSession: () => {
    if (typeof window === 'undefined') return;
    let token = localStorage.getItem('rpg_session_token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('rpg_session_token', token);
    }
    const savedName = localStorage.getItem('rpg_player_name') || '';
    set({ sessionToken: token, playerName: savedName });
  },

  setPlayerName: (name: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rpg_player_name', name);
    }
    set({ playerName: name });
  },

  // Campaign list actions
  setCampaigns: (campaigns) => set({ campaigns }),
  setIsLoadingCampaigns: (loading) => set({ isLoadingCampaigns: loading }),
  addCampaign: (campaign) => set((state) => ({
    campaigns: [campaign, ...state.campaigns],
  })),
  removeCampaign: (campaignId) => set((state) => ({
    campaigns: state.campaigns.filter((c) => c.campaign.id !== campaignId),
  })),

  // Current campaign actions
  setCurrentCampaign: (campaign) => set({ currentCampaign: campaign }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setAllPlayers: (players) => set({ allPlayers: players }),
  updateCampaign: (updates) => set((state) => ({
    currentCampaign: state.currentCampaign
      ? { ...state.currentCampaign, ...updates }
      : null,
  })),

  // Game state actions
  setActionHistory: (actions) => set({ actionHistory: actions }),
  addAction: (action) => set((state) => ({
    actionHistory: [...state.actionHistory, action],
  })),
  setIsLoadingHistory: (loading) => set({ isLoadingHistory: loading }),

  // Turn actions
  updateTurn: (turnInfo) => {
    const { currentPlayer } = get();
    const isMyTurn = currentPlayer?.id === turnInfo.current_player_id;
    set({
      turnNumber: turnInfo.turn_number,
      currentTurnPlayerId: turnInfo.current_player_id,
      currentTurnPlayerName: turnInfo.current_player_name,
      isMyTurn,
    });
  },
  setIsMyTurn: (isMyTurn) => set({ isMyTurn }),

  // UI actions
  setIsPerformingAction: (performing) => set({ isPerformingAction: performing }),
  setLastDiceResults: (results) => set({ lastDiceResults: results }),
  setSuggestedActions: (actions) => set({ suggestedActions: actions }),

  // Reset actions
  resetCurrentCampaign: () => set({
    currentCampaign: null,
    currentPlayer: null,
    allPlayers: [],
    actionHistory: [],
    isMyTurn: false,
    turnNumber: 0,
    currentTurnPlayerId: null,
    currentTurnPlayerName: null,
    lastDiceResults: [],
    suggestedActions: [],
  }),

  resetAll: () => set({
    campaigns: [],
    currentCampaign: null,
    currentPlayer: null,
    allPlayers: [],
    actionHistory: [],
    isMyTurn: false,
    turnNumber: 0,
    currentTurnPlayerId: null,
    currentTurnPlayerName: null,
    isPerformingAction: false,
    lastDiceResults: [],
    suggestedActions: [],
  }),
}));
