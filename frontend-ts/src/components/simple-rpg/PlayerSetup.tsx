'use client';

import { useState } from 'react';
import { Loader2, UserPlus, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleGameStore } from '@/stores/simpleGameStore';
import { generateSimpleOpening } from '@/lib/api';
import { AttributeAllocator } from './AttributeAllocator';
import type { SimplePlayer } from '@/lib/types';

export function PlayerSetup() {
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
      setError('Please enter your name');
      return;
    }
    if (!characterName.trim()) {
      setError('Please enter a character name');
      return;
    }
    if (!concept.trim()) {
      setError('Please describe your character');
      return;
    }
    if (!isAllocationComplete()) {
      setError('Please assign all attribute modifiers');
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
      setError('Add at least one player to start!');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await generateSimpleOpening(worldSetting, players);
      startGame(response.opening_scene, response.suggested_actions);
    } catch (err) {
      console.error('Failed to start game:', err);
      setError('Failed to start the adventure. Please try again.');
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Current Players */}
      {players.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Heroes ({players.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div>
                    <div className="font-medium">{player.characterName}</div>
                    <div className="text-sm text-muted-foreground">
                      {player.concept} (played by {player.playerName})
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {Object.entries(player.attributeScores)
                        .map(([name, score]) => `${name}: ${score >= 0 ? '+' : ''}${score}`)
                        .join(', ')}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePlayer(player.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
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
            Add a Hero
          </CardTitle>
          <CardDescription>
            Create a character for the adventure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="player-name">Your Name</Label>
              <Input
                id="player-name"
                placeholder="Alex"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="character-name">Character Name</Label>
              <Input
                id="character-name"
                placeholder="Whiskers the Brave"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="concept">Character Concept</Label>
            <Input
              id="concept"
              placeholder="A curious cat who dreams of adventure"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A short description of who your character is
            </p>
          </div>

          <div className="space-y-2">
            <Label>Attribute Scores</Label>
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
            Add Hero
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
            Starting Adventure...
          </>
        ) : (
          <>
            <Play className="h-5 w-5 mr-2" />
            Start the Adventure!
          </>
        )}
      </Button>
    </div>
  );
}
