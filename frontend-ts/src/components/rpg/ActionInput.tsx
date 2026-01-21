'use client';

import { useState, KeyboardEvent } from 'react';
import { Loader2, Send, SkipForward, Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface ActionInputProps {
  isYourTurn: boolean;
  isPerforming: boolean;
  suggestedActions: string[];
  onTakeAction: (action: string) => void;
  onEndTurn: () => void;
}

export function ActionInput({
  isYourTurn,
  isPerforming,
  suggestedActions,
  onTakeAction,
  onEndTurn,
}: ActionInputProps) {
  const [action, setAction] = useState('');

  const handleSubmit = () => {
    if (!action.trim() || !isYourTurn || isPerforming) return;
    onTakeAction(action.trim());
    setAction('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isYourTurn || isPerforming) return;
    onTakeAction(suggestion);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          placeholder={
            isYourTurn
              ? "What do you do? (Ctrl+Enter to submit)"
              : "Waiting for your turn..."
          }
          value={action}
          onChange={(e) => setAction(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isYourTurn || isPerforming}
          className={`min-h-[80px] pr-24 resize-none ${
            isYourTurn ? 'border-green-500/50 focus:border-green-500' : ''
          }`}
        />
        <div className="absolute bottom-2 right-2 flex gap-1">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!action.trim() || !isYourTurn || isPerforming}
          >
            {isPerforming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Dices className="h-4 w-4 mr-1" />
                Act
              </>
            )}
          </Button>
        </div>
      </div>

      {suggestedActions.length > 0 && isYourTurn && !isPerforming && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Quick actions:</span>
          {suggestedActions.map((suggestion, idx) => (
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

      {isYourTurn && !isPerforming && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onEndTurn}
            className="text-muted-foreground"
          >
            <SkipForward className="h-4 w-4 mr-1" />
            End Turn
          </Button>
        </div>
      )}
    </div>
  );
}
