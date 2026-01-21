'use client';

import { Heart, Shield, Crown, Swords } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Player } from '@/lib/types';

interface CharacterCardProps {
  player: Player;
  isCurrentTurn?: boolean;
  isYou?: boolean;
  onClick?: () => void;
  clickable?: boolean;
}

export function CharacterCard({ player, isCurrentTurn, isYou, onClick, clickable }: CharacterCardProps) {
  const character = player.character_sheet;

  const healthPercent = character
    ? Math.round((character.health / character.max_health) * 100)
    : 100;

  const healthColor =
    healthPercent > 60
      ? 'bg-green-500'
      : healthPercent > 30
      ? 'bg-yellow-500'
      : 'bg-red-500';

  return (
    <Card
      className={`transition-all ${
        isCurrentTurn
          ? 'border-green-500 shadow-lg shadow-green-500/20'
          : ''
      } ${isYou ? 'bg-accent/30 ring-2 ring-primary' : ''} ${
        clickable ? 'cursor-pointer hover:bg-accent/50' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {character?.name || player.name}
            </span>
            {player.is_gm && (
              <Crown className="h-3 w-3 text-amber-500" />
            )}
          </div>
          {isCurrentTurn && (
            <Badge variant="outline" className="text-xs border-green-500 text-green-500">
              <Swords className="h-3 w-3 mr-1" />
              Turn
            </Badge>
          )}
          {isYou && !isCurrentTurn && (
            <Badge variant="outline" className="text-xs">You</Badge>
          )}
        </div>

        {character && (
          <>
            <div className="text-xs text-muted-foreground">
              Level {character.level} {character.character_class}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3 text-red-500" />
                  HP
                </span>
                <span>
                  {character.health}/{character.max_health}
                </span>
              </div>
              <Progress
                value={healthPercent}
                className={`h-1.5 ${healthColor}`}
              />
            </div>

            {character.attributes.length > 0 && (
              <div className="grid grid-cols-2 gap-1 text-xs">
                {character.attributes.slice(0, 4).map((attr) => (
                  <div key={attr.name} className="flex justify-between text-muted-foreground">
                    <span>{attr.name.slice(0, 3)}</span>
                    <span className="font-mono">{attr.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!character && (
          <div className="text-xs text-muted-foreground italic">
            No character yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
