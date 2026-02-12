'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SimplePlayer } from '@/lib/types';

export interface SimplePlayerCardProps {
  player: SimplePlayer;
  /** Whether this player is currently active/selected */
  isActive?: boolean;
  /** Whether to show the remove button */
  showRemove?: boolean;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Additional className for the card */
  className?: string;
  /** Translation namespace */
  translationNamespace?: string;
}

/**
 * Shared player card component for simple-rpg feature.
 * Used in both PlayerSetup (showing added players) and SimpleGameView (showing active party).
 *
 * Features:
 * - Displays character name, concept, and player name
 * - Shows attribute scores as colored badges
 * - Optional active state highlighting (amber border)
 * - Optional remove button
 * - Fully internationalized
 */
export function SimplePlayerCard({
  player,
  isActive = false,
  showRemove = false,
  onRemove,
  className = '',
  translationNamespace = 'simpleRpg.players',
}: SimplePlayerCardProps) {
  const t = useTranslations(translationNamespace);

  return (
    <div
      className={`
        flex items-center justify-between p-3 rounded-lg border transition-all
        ${isActive
          ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500'
          : 'border-border bg-card'
        }
        ${className}
      `}
    >
      <div className="flex-1 min-w-0">
        {/* Character Name */}
        <div className="font-medium flex items-center gap-2">
          {player.characterName}
          {isActive && (
            <Badge variant="default" className="text-xs">
              {t('activeBadge', { defaultValue: 'Active' })}
            </Badge>
          )}
        </div>

        {/* Concept & Player Name */}
        <div className="text-sm text-muted-foreground">
          {player.concept}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {t('playedBy', { playerName: player.playerName, defaultValue: `played by ${player.playerName}` })}
        </div>

        {/* Attribute Scores */}
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(player.attributeScores).map(([name, score]) => (
            <Badge
              key={name}
              variant="secondary"
              className="text-xs font-mono"
            >
              {name}: {score >= 0 ? '+' : ''}{score}
            </Badge>
          ))}
        </div>
      </div>

      {/* Remove Button */}
      {showRemove && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="ml-2 shrink-0"
          aria-label={t('removePlayer', { defaultValue: 'Remove player' })}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
        </Button>
      )}
    </div>
  );
}
