'use client';

import { Swords, Clock, Hourglass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TurnIndicatorProps {
  turnNumber: number;
  currentPlayerName: string | null;
  isYourTurn: boolean;
}

export function TurnIndicator({ turnNumber, currentPlayerName, isYourTurn }: TurnIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        Turn {turnNumber}
      </Badge>

      {isYourTurn ? (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1">
          <Swords className="h-3 w-3" />
          Your Turn!
        </Badge>
      ) : currentPlayerName ? (
        <Badge variant="secondary" className="gap-1">
          <Hourglass className="h-3 w-3" />
          Waiting for {currentPlayerName}
        </Badge>
      ) : null}
    </div>
  );
}
