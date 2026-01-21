'use client';

import { Users, MousePointer2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CharacterCard } from './CharacterCard';
import type { Player } from '@/lib/types';

interface PartyPanelProps {
  players: Player[];
  currentTurnPlayerId: string | null;
  yourPlayerId?: string;
  onSelectPlayer?: (player: Player) => void;
  localMultiplayer?: boolean;
}

export function PartyPanel({
  players,
  currentTurnPlayerId,
  yourPlayerId,
  onSelectPlayer,
  localMultiplayer = false,
}: PartyPanelProps) {
  // Sort: you first, then current turn, then by turn position
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.id === yourPlayerId) return -1;
    if (b.id === yourPlayerId) return 1;
    if (a.id === currentTurnPlayerId) return -1;
    if (b.id === currentTurnPlayerId) return 1;
    return (a.turn_position ?? 0) - (b.turn_position ?? 0);
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Party ({players.length})
        </CardTitle>
        {localMultiplayer && players.length > 1 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MousePointer2 className="h-3 w-3" />
            Click a character to play as them
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {sortedPlayers.map((player) => (
          <CharacterCard
            key={player.id}
            player={player}
            isCurrentTurn={player.id === currentTurnPlayerId}
            isYou={player.id === yourPlayerId}
            onClick={localMultiplayer && onSelectPlayer ? () => onSelectPlayer(player) : undefined}
            clickable={localMultiplayer && players.length > 1}
          />
        ))}
      </CardContent>
    </Card>
  );
}
