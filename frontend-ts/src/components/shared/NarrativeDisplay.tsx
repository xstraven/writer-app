'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Generic action type that works with both CampaignAction and SimpleGameAction
 */
export interface NarrativeAction {
  id: string;
  type: 'player_action' | 'gm_narration' | 'system';
  playerName?: string;
  content: string;
  turnNumber?: number;
  timestamp?: number;
}

export interface NarrativeDisplayProps {
  /** Array of actions to display */
  actions: NarrativeAction[];
  /** Translation namespace for labels */
  translationNamespace?: string;
  /** Whether to show turn numbers */
  showTurnNumbers?: boolean;
  /** Height of scroll area */
  height?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom className for container */
  className?: string;
}

/**
 * Shared narrative display component for RPG game logs.
 * Used by both simple-rpg and campaigns features.
 *
 * Features:
 * - Auto-scrolls to newest action
 * - Colored borders for different action types
 * - Player names and GM labels
 * - Optional turn number badges
 * - Internationalization support
 */
export function NarrativeDisplay({
  actions,
  translationNamespace = 'shared.narrative',
  showTurnNumbers = false,
  height = 'h-[400px]',
  emptyMessage,
  className,
}: NarrativeDisplayProps) {
  const t = useTranslations(translationNamespace);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new actions
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actions.length]);

  const defaultEmptyMessage = emptyMessage || t('awaiting', {
    defaultValue: 'The adventure awaits...'
  });

  return (
    <ScrollArea className={`${height} rounded-md border ${className || ''}`} ref={scrollRef}>
      <div className="p-4 space-y-4">
        {actions.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            {defaultEmptyMessage}
          </p>
        )}

        {actions.map((action, idx) => (
          <ActionEntry
            key={action.id || idx}
            action={action}
            showTurnNumber={showTurnNumbers}
            translationNamespace={translationNamespace}
          />
        ))}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}

interface ActionEntryProps {
  action: NarrativeAction;
  showTurnNumber: boolean;
  translationNamespace: string;
}

function ActionEntry({ action, showTurnNumber, translationNamespace }: ActionEntryProps) {
  const t = useTranslations(translationNamespace);

  const getActionStyle = (type: string) => {
    switch (type) {
      case 'player_action':
        return 'border-l-blue-500 bg-blue-500/5';
      case 'gm_narration':
        return 'border-l-amber-500 bg-amber-500/5';
      case 'system':
        return 'border-l-gray-500 bg-gray-500/5 text-muted-foreground italic';
      default:
        return '';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'player_action':
        return <User className="h-3 w-3" />;
      case 'gm_narration':
        return <BookOpen className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getActionLabel = (action: NarrativeAction) => {
    if (action.type === 'player_action') {
      return action.playerName || t('player', { defaultValue: 'Player' });
    }
    if (action.type === 'gm_narration') {
      return t('gameMaster', { defaultValue: 'Game Master' });
    }
    return t('system', { defaultValue: 'System' });
  };

  const getLabelColor = (type: string) => {
    switch (type) {
      case 'player_action':
        return 'text-blue-600';
      case 'gm_narration':
        return 'text-amber-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className={`p-3 rounded-r-md border-l-4 ${getActionStyle(action.type)}`}>
      <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
        {getActionIcon(action.type)}
        <span className={`font-medium ${getLabelColor(action.type)}`}>
          {getActionLabel(action)}
        </span>
        {showTurnNumber && action.turnNumber && action.turnNumber > 0 && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {t('turn', { number: action.turnNumber, defaultValue: `Turn ${action.turnNumber}` })}
          </Badge>
        )}
      </div>

      <div className="text-sm whitespace-pre-wrap">
        {action.type === 'player_action' && (
          <span className="text-blue-500">&gt; </span>
        )}
        {action.content}
      </div>
    </div>
  );
}
