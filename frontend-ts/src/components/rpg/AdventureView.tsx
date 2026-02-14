'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Share2, Settings, Play, Users, UserPlus, Loader2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { NarrativeLog } from './NarrativeLog';
import { ActionInput } from './ActionInput';
import { PartyPanel } from './PartyPanel';
import { TurnIndicator } from './TurnIndicator';
import { DiceResults } from './DiceResults';
import { AddPlayerForm } from '@/components/campaign/AddPlayerForm';
import { useCampaignStore } from '@/stores/campaignStore';
import {
  getCampaign,
  getActionHistory,
  getTurnInfo,
  takeCampaignAction,
  endTurn,
  startCampaign,
} from '@/lib/api';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Campaign, Player } from '@/lib/types';

interface AdventureViewProps {
  campaignId: string;
}

export function AdventureView({ campaignId }: AdventureViewProps) {
  const router = useRouter();
  const {
    currentCampaign,
    currentPlayer,
    allPlayers,
    actionHistory,
    isMyTurn,
    turnNumber,
    currentTurnPlayerId,
    currentTurnPlayerName,
    isPerformingAction,
    lastDiceResults,
    suggestedActions,
    setCurrentCampaign,
    setCurrentPlayer,
    setAllPlayers,
    setActionHistory,
    addAction,
    updateTurn,
    setIsPerformingAction,
    setLastDiceResults,
    setSuggestedActions,
    setIsLoadingHistory,
    ttsEnabled,
    ttsAutoRead,
    setTtsEnabled,
    setTtsAutoRead,
  } = useCampaignStore();

  const tToast = useTranslations('toast');
  const t = useTranslations('rpg.adventure');

  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const isTtsSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Check if we're in local multiplayer mode (multiple players on same device)
  // This is true when there are multiple players in the campaign
  const isLocalMultiplayer = allPlayers.length > 1;

  // Load campaign data
  const loadCampaign = useCallback(async () => {
    try {
      const data = await getCampaign(campaignId);
      setCurrentCampaign(data.campaign);
      setAllPlayers(data.players);
      setCurrentPlayer(data.your_player || null);

      // Load action history
      const actions = await getActionHistory(campaignId);
      setActionHistory(actions);

      // Load turn info
      if (data.campaign.status === 'active') {
        const turnInfo = await getTurnInfo(campaignId);
        updateTurn(turnInfo);
      }
    } catch (error) {
      console.error('Failed to load campaign:', error);
      toast.error(tToast('adventureLoadFailed'));
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, router, setCurrentCampaign, setAllPlayers, setCurrentPlayer, setActionHistory, updateTurn]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  // Poll for updates (loose turns — always poll so all players see changes)
  useEffect(() => {
    if (!currentCampaign || currentCampaign.status !== 'active') return;

    const pollInterval = setInterval(async () => {
      try {
        const [turnInfo, actions] = await Promise.all([
          getTurnInfo(campaignId),
          getActionHistory(campaignId),
        ]);
        updateTurn(turnInfo);
        setActionHistory(actions);
      } catch (error) {
        console.error('Poll failed:', error);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [campaignId, currentCampaign, updateTurn, setActionHistory]);

  const handleTakeAction = async (action: string) => {
    if (!currentPlayer) return;

    setIsPerformingAction(true);
    setLastDiceResults([]);

    try {
      const response = await takeCampaignAction(campaignId, {
        player_id: currentPlayer.id,
        action,
        use_dice: true,
      });

      // Add both the player action and GM narration
      addAction(response.action);
      addAction({
        id: `narration-${Date.now()}`,
        campaign_id: campaignId,
        player_id: null,
        action_type: 'gm_narration',
        content: response.narrative,
        action_results: [],
        turn_number: turnNumber,
        created_at: new Date().toISOString(),
      });

      setLastDiceResults(response.action_results);
      setSuggestedActions(response.available_actions);

      // Refresh turn info
      const turnInfo = await getTurnInfo(campaignId);
      updateTurn(turnInfo);
    } catch (error: any) {
      console.error('Failed to take action:', error);
      toast.error(error.response?.data?.detail || tToast('actionFailed'));
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handleEndTurn = async (nextPlayerId?: string) => {
    if (!currentPlayer) return;

    try {
      const turnInfo = await endTurn(campaignId, {
        player_id: currentPlayer.id,
        next_player_id: nextPlayerId,
      });
      updateTurn(turnInfo);
      toast.success(tToast('turnPassed', { playerName: turnInfo.current_player_name || 'Unknown' }));
    } catch (error: any) {
      console.error('Failed to end turn:', error);
      toast.error(error.response?.data?.detail || tToast('turnEndFailed'));
    }
  };

  const handleStartCampaign = async () => {
    if (!currentPlayer) return;

    setIsStarting(true);
    try {
      const response = await startCampaign(campaignId, { player_id: currentPlayer.id });
      setCurrentCampaign(response.campaign);

      // Add opening scene to history
      addAction({
        id: `opening-${Date.now()}`,
        campaign_id: campaignId,
        player_id: null,
        action_type: 'gm_narration',
        content: response.opening_scene,
        action_results: [],
        turn_number: 0,
        created_at: new Date().toISOString(),
      });

      setSuggestedActions(response.available_actions);

      // Get turn info
      const turnInfo = await getTurnInfo(campaignId);
      updateTurn(turnInfo);

      toast.success(tToast('adventureStarted'));
    } catch (error: any) {
      console.error('Failed to start campaign:', error);
      toast.error(error.response?.data?.detail || tToast('adventureStartFailed'));
    } finally {
      setIsStarting(false);
    }
  };

  const copyInviteCode = () => {
    if (!currentCampaign) return;
    navigator.clipboard.writeText(currentCampaign.invite_code);
    toast.success(tToast('inviteCodeCopied'));
  };

  const copyInviteLink = () => {
    if (!currentCampaign) return;
    const link = `${window.location.origin}/campaigns/join?code=${currentCampaign.invite_code}`;
    navigator.clipboard.writeText(link);
    toast.success(tToast('inviteLinkCopied'));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentCampaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Button variant="link" onClick={() => router.push('/')}>
          {t('returnToLobby')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{currentCampaign.name}</h1>
            {currentCampaign.status === 'active' && (
              <TurnIndicator
                turnNumber={turnNumber}
                currentPlayerName={currentTurnPlayerName}
                isYourTurn={isMyTurn}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isTtsSupported && currentCampaign.status === 'active' && (
            <div className="flex items-center gap-1">
              <Button
                variant={ttsEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  const newEnabled = !ttsEnabled;
                  setTtsEnabled(newEnabled);
                  if (!newEnabled) setTtsAutoRead(false);
                }}
                title={ttsEnabled ? t('ttsDisable') : t('ttsEnable')}
              >
                {ttsEnabled ? (
                  <Volume2 className="h-4 w-4 mr-1" />
                ) : (
                  <VolumeX className="h-4 w-4 mr-1" />
                )}
                {t('ttsLabel')}
              </Button>
              {ttsEnabled && (
                <Button
                  variant={ttsAutoRead ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTtsAutoRead(!ttsAutoRead)}
                  title={ttsAutoRead ? t('autoReadDisable') : t('autoReadEnable')}
                >
                  {t('autoLabel')}
                </Button>
              )}
            </div>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-1" />
                {t('inviteButton')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('inviteTitle')}</DialogTitle>
                <DialogDescription>
                  {t('inviteDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
                  <span className="text-2xl font-mono font-bold tracking-widest">
                    {currentCampaign.invite_code}
                  </span>
                  <Button size="sm" variant="ghost" onClick={copyInviteCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button className="w-full" onClick={copyInviteLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  {t('copyInviteLink')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lobby Mode */}
      {currentCampaign.status === 'lobby' && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('waitingForPlayers')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('lobbyInstructions')}
            </p>

            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-lg font-mono px-4 py-2">
                {currentCampaign.invite_code}
              </Badge>
              <Button size="sm" variant="outline" onClick={copyInviteCode}>
                <Copy className="h-4 w-4 mr-1" />
                {t('copy')}
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">{t('party', { count: allPlayers.length })}</h4>
              </div>

              {allPlayers.length === 1 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                  {t('addFriendsHint')}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allPlayers.map((player) => (
                  <div key={player.id} className="p-3 bg-accent/50 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {player.character_sheet?.name || player.name}
                      </span>
                      <div className="flex gap-1">
                        {player.is_gm && <Badge className="text-xs">{t('gmBadge')}</Badge>}
                        {player.id === currentPlayer?.id && <Badge variant="outline" className="text-xs">{t('youBadge')}</Badge>}
                      </div>
                    </div>
                    {player.character_sheet && (
                      <p className="text-xs text-muted-foreground">
                        {player.character_sheet.character_class}
                        {player.character_sheet.special_trait && ` — ${player.character_sheet.special_trait}`}
                      </p>
                    )}
                    {player.character_sheet?.name && player.name !== player.character_sheet.name && (
                      <p className="text-xs text-muted-foreground/60">
                        {t('playerLabel', { name: player.name })}
                      </p>
                    )}
                  </div>
                ))}

                {allPlayers.length < 5 && (
                  <AddPlayerForm
                    campaignId={campaignId}
                    gameStyle={currentCampaign.game_system?.style}
                    attributes={currentCampaign.game_system?.attribute_details}
                    onPlayerAdded={(player) => {
                      setAllPlayers([...allPlayers, player]);
                    }}
                    trigger={
                      <button
                        type="button"
                        className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-accent/30 transition-colors min-h-[72px] cursor-pointer"
                      >
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{t('addFriend')}</span>
                      </button>
                    }
                  />
                )}
              </div>
            </div>

            {currentPlayer?.is_gm && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleStartCampaign}
                disabled={isStarting || allPlayers.length < 1}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('startingAdventure')}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {t('startAdventure')}
                  </>
                )}
              </Button>
            )}

            {!currentPlayer?.is_gm && (
              <p className="text-center text-sm text-muted-foreground">
                {t('waitingForGm')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Game */}
      {currentCampaign.status === 'active' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('adventureLog')}</CardTitle>
              </CardHeader>
              <CardContent>
                <NarrativeLog actions={actionHistory} players={allPlayers} />
              </CardContent>
            </Card>

            {lastDiceResults.length > 0 && (
              <DiceResults results={lastDiceResults} />
            )}

            <Card>
              <CardContent className="pt-4">
                <ActionInput
                  isYourTurn={isMyTurn}
                  isPerforming={isPerformingAction}
                  suggestedActions={suggestedActions}
                  onTakeAction={handleTakeAction}
                  onEndTurn={handleEndTurn}
                  allPlayers={allPlayers}
                  currentPlayer={currentPlayer}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <PartyPanel
              players={allPlayers}
              currentTurnPlayerId={currentTurnPlayerId}
              yourPlayerId={currentPlayer?.id}
              localMultiplayer={isLocalMultiplayer}
              gameStyle={currentCampaign?.game_system?.style}
              onSelectPlayer={(player) => {
                setCurrentPlayer(player);
                // Update isMyTurn based on selected player
                const newIsMyTurn = player.id === currentTurnPlayerId;
                toast.success(tToast('nowPlayingAs', { characterName: player.character_sheet?.name || player.name }));
              }}
            />

            {currentCampaign.game_system && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('gameRules')}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p><strong>{t('system')}</strong> {currentCampaign.game_system.name}</p>
                  <p><strong>{t('mechanic')}</strong> {currentCampaign.game_system.core_mechanic}</p>
                  {currentCampaign.game_system.skill_check_rules && (
                    <p><strong>{t('skillChecks')}</strong> {currentCampaign.game_system.skill_check_rules}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
