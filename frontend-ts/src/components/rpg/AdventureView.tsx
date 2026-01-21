'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Share2, Settings, Play, Users, Loader2 } from 'lucide-react';
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
  } = useCampaignStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

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
      toast.error('Failed to load adventure');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, router, setCurrentCampaign, setAllPlayers, setCurrentPlayer, setActionHistory, updateTurn]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  // Poll for updates when it's not your turn
  useEffect(() => {
    if (!currentCampaign || currentCampaign.status !== 'active' || isMyTurn) return;

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
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [campaignId, currentCampaign, isMyTurn, updateTurn, setActionHistory]);

  const handleTakeAction = async (action: string) => {
    if (!currentPlayer || !isMyTurn) return;

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
      toast.error(error.response?.data?.detail || 'Failed to take action');
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handleEndTurn = async () => {
    if (!currentPlayer || !isMyTurn) return;

    try {
      const turnInfo = await endTurn(campaignId, { player_id: currentPlayer.id });
      updateTurn(turnInfo);
      toast.success(`Turn passed to ${turnInfo.current_player_name}`);
    } catch (error: any) {
      console.error('Failed to end turn:', error);
      toast.error(error.response?.data?.detail || 'Failed to end turn');
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

      toast.success('Adventure started!');
    } catch (error: any) {
      console.error('Failed to start campaign:', error);
      toast.error(error.response?.data?.detail || 'Failed to start adventure');
    } finally {
      setIsStarting(false);
    }
  };

  const copyInviteCode = () => {
    if (!currentCampaign) return;
    navigator.clipboard.writeText(currentCampaign.invite_code);
    toast.success('Invite code copied!');
  };

  const copyInviteLink = () => {
    if (!currentCampaign) return;
    const link = `${window.location.origin}/campaigns/join?code=${currentCampaign.invite_code}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
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
        <p className="text-muted-foreground">Adventure not found</p>
        <Button variant="link" onClick={() => router.push('/')}>
          Return to lobby
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
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-1" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Players</DialogTitle>
                <DialogDescription>
                  Share this code or link with friends to join the adventure.
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
                  Copy Invite Link
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
              Waiting for Players
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share the invite code with friends. When everyone is ready, the GM can start the adventure.
            </p>

            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-lg font-mono px-4 py-2">
                {currentCampaign.invite_code}
              </Badge>
              <Button size="sm" variant="outline" onClick={copyInviteCode}>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Players ({allPlayers.length})</h4>
                <AddPlayerForm
                  campaignId={campaignId}
                  onPlayerAdded={(player) => {
                    setAllPlayers([...allPlayers, player]);
                  }}
                />
              </div>
              <div className="space-y-2">
                {allPlayers.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-2 bg-accent/50 rounded">
                    <span>
                      {player.character_sheet?.name || player.name}
                      {player.character_sheet && ` (${player.character_sheet.character_class})`}
                    </span>
                    <div className="flex gap-2">
                      {player.is_gm && <Badge>GM</Badge>}
                      {player.id === currentPlayer?.id && <Badge variant="outline">You</Badge>}
                    </div>
                  </div>
                ))}
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
                    Starting Adventure...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Adventure
                  </>
                )}
              </Button>
            )}

            {!currentPlayer?.is_gm && (
              <p className="text-center text-sm text-muted-foreground">
                Waiting for the GM to start the adventure...
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
                <CardTitle className="text-sm">Adventure Log</CardTitle>
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
              onSelectPlayer={(player) => {
                setCurrentPlayer(player);
                // Update isMyTurn based on selected player
                const newIsMyTurn = player.id === currentTurnPlayerId;
                toast.success(`Now playing as ${player.character_sheet?.name || player.name}`);
              }}
            />

            {currentCampaign.game_system && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Game Rules</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p><strong>System:</strong> {currentCampaign.game_system.name}</p>
                  <p><strong>Mechanic:</strong> {currentCampaign.game_system.core_mechanic}</p>
                  {currentCampaign.game_system.skill_check_rules && (
                    <p><strong>Skill Checks:</strong> {currentCampaign.game_system.skill_check_rules}</p>
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
