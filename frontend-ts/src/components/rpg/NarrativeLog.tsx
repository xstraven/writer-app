'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dices, User, BookOpen, Settings } from 'lucide-react';
import type { CampaignAction, Player } from '@/lib/types';

interface NarrativeLogProps {
  actions: CampaignAction[];
  players: Player[];
}

export function NarrativeLog({ actions, players }: NarrativeLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Get player name by ID
  const getPlayerName = (playerId: string | null): string => {
    if (!playerId) return 'Game Master';
    const player = players.find((p) => p.id === playerId);
    return player?.character_sheet?.name || player?.name || 'Unknown';
  };

  // Auto-scroll to bottom on new actions
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actions.length]);

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'player_action':
        return <User className="h-4 w-4" />;
      case 'gm_narration':
        return <BookOpen className="h-4 w-4" />;
      case 'dice_roll':
        return <Dices className="h-4 w-4" />;
      case 'system':
        return <Settings className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getActionStyle = (type: string) => {
    switch (type) {
      case 'player_action':
        return 'border-l-blue-500 bg-blue-500/5';
      case 'gm_narration':
        return 'border-l-amber-500 bg-amber-500/5';
      case 'dice_roll':
        return 'border-l-purple-500 bg-purple-500/5';
      case 'system':
        return 'border-l-gray-500 bg-gray-500/5 text-muted-foreground italic';
      default:
        return '';
    }
  };

  return (
    <ScrollArea className="h-[400px] rounded-md border" ref={scrollRef}>
      <div className="p-4 space-y-4">
        {actions.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            The adventure awaits...
          </p>
        )}

        {actions.map((action, idx) => (
          <div
            key={action.id || idx}
            className={`p-3 rounded-r-md border-l-4 ${getActionStyle(action.action_type)}`}
          >
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              {getActionIcon(action.action_type)}
              <span className="font-medium">
                {action.action_type === 'player_action'
                  ? getPlayerName(action.player_id)
                  : action.action_type === 'gm_narration'
                  ? 'Game Master'
                  : action.action_type === 'system'
                  ? 'System'
                  : 'Dice Roll'}
              </span>
              {action.turn_number > 0 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  Turn {action.turn_number}
                </Badge>
              )}
            </div>

            <div className="text-sm whitespace-pre-wrap">
              {action.action_type === 'player_action' && (
                <span className="text-blue-500">&gt; </span>
              )}
              {action.content}
            </div>

            {action.action_results.length > 0 && (
              <div className="mt-2 space-y-1">
                {action.action_results.map((result, rIdx) => (
                  <div
                    key={rIdx}
                    className={`text-xs p-1.5 rounded ${
                      result.success
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}
                  >
                    <Dices className="h-3 w-3 inline mr-1" />
                    {result.check_type}: {result.roll_result} + {result.modifier} ={' '}
                    {result.total} vs DC {result.target_number} -{' '}
                    {result.success ? 'Success!' : 'Failed'}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
