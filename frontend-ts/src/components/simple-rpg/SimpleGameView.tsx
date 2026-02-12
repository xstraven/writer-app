'use client';

import { useState, KeyboardEvent, useMemo } from 'react';
import { Loader2, Send, Users, BookOpen, Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleGameStore } from '@/stores/simpleGameStore';
import { resolveSimpleAction } from '@/lib/api';
import { SimpleDiceResults } from './SimpleDiceResults';
import { SimplePlayerCard } from './SimplePlayerCard';
import { NarrativeDisplay, type NarrativeAction } from '@/components/shared/NarrativeDisplay';
import { useTranslations } from 'next-intl';
import type { SimpleGameAction, SimpleDiceResult } from '@/lib/types';

export function SimpleGameView() {
  const t = useTranslations('simpleRpg.game');

  const {
    worldSetting,
    players,
    currentPlayerIndex,
    actionHistory,
    turnNumber,
    isGenerating,
    suggestedActions,
    lastDiceResult,
    setGenerating,
    setSuggestedActions,
    setLastDiceResult,
    addAction,
    nextTurn,
    getCurrentPlayer,
  } = useSimpleGameStore();

  const [actionText, setActionText] = useState('');

  const currentPlayer = getCurrentPlayer();

  // Convert SimpleGameAction to NarrativeAction for shared component
  const narrativeActions = useMemo((): NarrativeAction[] => {
    return actionHistory.map((action) => ({
      id: action.id,
      type: action.type as 'player_action' | 'gm_narration',
      playerName: action.playerName,
      content: action.content,
      timestamp: action.timestamp,
    }));
  }, [actionHistory]);

  const handleTakeAction = async (action: string) => {
    if (!action.trim() || !currentPlayer || isGenerating) return;

    setGenerating(true);
    setLastDiceResult(null);

    // Add player action to history immediately
    const playerAction: SimpleGameAction = {
      id: crypto.randomUUID(),
      type: 'player_action',
      playerId: currentPlayer.id,
      playerName: currentPlayer.characterName,
      content: action,
      timestamp: Date.now(),
    };
    addAction(playerAction);

    try {
      const response = await resolveSimpleAction(
        worldSetting,
        [...actionHistory, playerAction],
        currentPlayer,
        action,
        players
      );

      // Convert API dice result to frontend format
      let diceResult: SimpleDiceResult | undefined;
      if (response.dice_result) {
        diceResult = {
          attributeUsed: response.dice_result.attribute_used,
          modifier: response.dice_result.modifier,
          roll: response.dice_result.roll,
          total: response.dice_result.total,
          outcome: response.dice_result.outcome,
        };
        setLastDiceResult(diceResult);
      }

      // Add GM narration
      const gmAction: SimpleGameAction = {
        id: crypto.randomUUID(),
        type: 'gm_narration',
        content: response.narrative,
        diceResult,
        timestamp: Date.now(),
      };
      addAction(gmAction);

      setSuggestedActions(response.suggested_actions);
      setActionText('');

      // Advance to next player
      nextTurn();
    } catch (err) {
      console.error('Failed to resolve action:', err);
      // Add error narration
      const errorAction: SimpleGameAction = {
        id: crypto.randomUUID(),
        type: 'gm_narration',
        content: t('errorMessage'),
        timestamp: Date.now(),
      };
      addAction(errorAction);
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleTakeAction(actionText);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isGenerating) return;
    handleTakeAction(suggestion);
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main Game Area */}
      <div className="lg:col-span-2 space-y-4">
        {/* Turn Indicator */}
        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-500/20">
                  <Dices className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('turn', { number: turnNumber })}</div>
                  <div className="font-bold">
                    {t('turnOf', { characterName: currentPlayer?.characterName })}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="text-muted-foreground">
                {currentPlayer?.playerName}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Dice Results */}
        {lastDiceResult && <SimpleDiceResults result={lastDiceResult} />}

        {/* Narrative Log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('storyTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <NarrativeDisplay
              actions={narrativeActions}
              translationNamespace="shared.narrative"
              showTurnNumbers={false}
              height="h-[400px]"
            />
            {isGenerating && (
              <div className="flex items-center gap-2 text-muted-foreground p-4 border-t">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('storyUnfolds')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Input */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Textarea
                placeholder={t('actionPlaceholder', { characterName: currentPlayer?.characterName })}
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                className="min-h-[80px] pr-20 resize-none"
              />
              <Button
                size="sm"
                className="absolute bottom-2 right-2"
                onClick={() => handleTakeAction(actionText)}
                disabled={!actionText.trim() || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    {t('goButton')}
                  </>
                )}
              </Button>
            </div>

            {suggestedActions.length > 0 && !isGenerating && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">{t('ideasLabel')}</span>
                {suggestedActions.slice(0, 4).map((suggestion, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Party Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('heroesTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player, idx) => (
              <SimplePlayerCard
                key={player.id}
                player={player}
                isActive={idx === currentPlayerIndex}
                showRemove={false}
                translationNamespace="simpleRpg.game"
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
