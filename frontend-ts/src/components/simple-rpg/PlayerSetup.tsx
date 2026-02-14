'use client';

import { useState } from 'react';
import { Loader2, UserPlus, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleGameStore } from '@/stores/simpleGameStore';
import { generateSimpleOpening } from '@/lib/api';
import { AttributeAllocator, getValuePool } from '@/components/shared/AttributeAllocator';
import { SimplePlayerCard } from './SimplePlayerCard';
import { useActiveLocale } from '@/hooks/useActiveLocale';
import { CharacterFormFields, type CharacterFormData } from '@/components/shared/CharacterFormFields';
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

  const [formData, setFormData] = useState<CharacterFormData>({
    playerName: '',
    characterName: '',
    characterConcept: '',
    characterSpecial: '',
  });
  const [attributeScores, setAttributeScores] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = (field: keyof CharacterFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const availableModifiers = getValuePool(attributes.length, 'narrative');

  const isAllocationComplete = () => {
    const scores = Object.values(attributeScores);
    if (scores.length !== attributes.length) return false;

    const sortedScores = [...scores].sort((a, b) => b - a);
    const sortedModifiers = [...availableModifiers].sort((a, b) => b - a);

    return JSON.stringify(sortedScores) === JSON.stringify(sortedModifiers);
  };

  const handleAddPlayer = () => {
    if (!formData.playerName.trim()) {
      setError(t('errorNoPlayerName'));
      return;
    }
    if (!formData.characterName.trim()) {
      setError(t('errorNoCharacterName'));
      return;
    }
    if (!formData.characterConcept.trim()) {
      setError(t('errorNoConcept'));
      return;
    }
    if (!isAllocationComplete()) {
      setError(t('errorNoAttributes'));
      return;
    }

    const newPlayer: SimplePlayer = {
      id: crypto.randomUUID(),
      playerName: formData.playerName.trim(),
      characterName: formData.characterName.trim(),
      concept: formData.characterConcept.trim(),
      attributeScores: { ...attributeScores },
    };

    addPlayer(newPlayer);

    // Reset form
    setFormData({
      playerName: '',
      characterName: '',
      characterConcept: '',
      characterSpecial: '',
    });
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
    } finally {
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
          <CharacterFormFields
            formData={formData}
            onChange={handleFieldChange}
            disabled={false}
            gameStyle="simple"
            translationNamespace="shared.characterForm"
            showVoiceInput={false}
            showSpecialTrait={false}
            placeholders={{
              playerName: t('yourNamePlaceholder'),
              characterName: t('characterNamePlaceholder'),
              characterConcept: t('conceptPlaceholder'),
            }}
          />

          <div className="space-y-2">
            <Label>{t('attributeScores')}</Label>
            <AttributeAllocator
              attributes={attributes}
              availableValues={availableModifiers}
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
