'use client';

import { useState } from 'react';
import { Loader2, UserPlus, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleGameStore } from '@/stores/simpleGameStore';
import { generateSimpleOpening } from '@/lib/api';
import { AttributeAllocator } from './AttributeAllocator';
import { SimplePlayerCard } from './SimplePlayerCard';
import { useActiveLocale } from '@/hooks/useActiveLocale';
import type { SimplePlayer } from '@/lib/types';

export function PlayerSetup() {
  const t = useTranslations('simpleRpg.players');
  const currentLocale = useActiveLocale();

  const {
    worldSetting,
    attributes,
    players,
    addPlayer,
    removePlayer,
    startGame,
    setGenerating,
    setSuggestedActions,
    isGenerating,
  } = useSimpleGameStore();

  const [playerName, setPlayerName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [concept, setConcept] = useState('');
  const [attributeScores, setAttributeScores] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  // Determine available modifiers based on number of attributes
  const getAvailableModifiers = (): number[] => {
    const count = attributes.length;
    if (count <= 3) return [2, 1, 0];
    if (count === 4) return [2, 1, 0, -1];
    return [2, 1, 1, 0, -1]; // 5 attributes
  };

  const availableModifiers = getAvailableModifiers();

  const isAllocationComplete = () => {
    const scores = Object.values(attributeScores);
    if (scores.length !== attributes.length) return false;

    const sortedScores = [...scores].sort((a, b) => b - a);
    const sortedModifiers = [...availableModifiers].sort((a, b) => b - a);

    return JSON.stringify(sortedScores) === JSON.stringify(sortedModifiers);
  };

  const handleAddPlayer = () => {
    if (!playerName.trim()) {
      setError(t('errorNoPlayerName'));
      return;
    }
    if (!characterName.trim()) {
      setError(t('errorNoCharacterName'));
      return;
    }
    if (!concept.trim()) {
      setError(t('errorNoConcept'));
      return;
    }
    if (!isAllocationComplete()) {
      setError(t('errorNoAttributes'));
      return;
    }

    const newPlayer: SimplePlayer = {
      id: crypto.randomUUID(),
      playerName: playerName.trim(),
      characterName: characterName.trim(),
      concept: concept.trim(),
      attributeScores: { ...attributeScores },
    };

    addPlayer(newPlayer);

    // Reset form
    setPlayerName('');
    setCharacterName('');
    setConcept('');
    setAttributeScores({});
    setError(null);
  };

  const handleStartGame = async () => {
    if (players.length === 0) {
      setError(t('errorNoPlayers'));
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await generateSimpleOpening(worldSetting, players, currentLocale);
      startGame(response.opening_scene, response.suggested_actions);
    } catch (err) {
      console.error('Failed to start game:', err);
      setError(t('errorStartFailed'));
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Current Players */}
      {players.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('heroesTitle', { count: players.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {players.map((player) => (
                <SimplePlayerCard
                  key={player.id}
                  player={player}
                  showRemove={true}
                  onRemove={() => removePlayer(player.id)}
                  translationNamespace="simpleRpg.players"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Player Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t('addHeroTitle')}
          </CardTitle>
          <CardDescription>
            {t('addHeroDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="player-name">{t('yourName')}</Label>
              <Input
                id="player-name"
                placeholder={t('yourNamePlaceholder')}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="character-name">{t('characterName')}</Label>
              <Input
                id="character-name"
                placeholder={t('characterNamePlaceholder')}
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="concept">{t('concept')}</Label>
            <Input
              id="concept"
              placeholder={t('conceptPlaceholder')}
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('conceptHelp')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('attributeScores')}</Label>
            <AttributeAllocator
              attributes={attributes}
              availableModifiers={availableModifiers}
              currentScores={attributeScores}
              onChange={setAttributeScores}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button onClick={handleAddPlayer} className="w-full">
            <UserPlus className="h-4 w-4 mr-2" />
            {t('addHeroButton')}
          </Button>
        </CardContent>
      </Card>

      {/* Start Game Button */}
      <Button
        size="lg"
        onClick={handleStartGame}
        disabled={players.length === 0 || isGenerating}
        className="w-full h-14 text-lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {t('starting')}
          </>
        ) : (
          <>
            <Play className="h-5 w-5 mr-2" />
            {t('startButton')}
          </>
        )}
      </Button>
    </div>
  );
}
