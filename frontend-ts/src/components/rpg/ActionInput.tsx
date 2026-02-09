'use client';

import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { Loader2, SkipForward, Dices, Mic, Keyboard, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { VoiceInput } from '@/components/ui/voice-input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Player } from '@/lib/types';

const VOICE_MODE_KEY = 'storycraft-voice-mode';

interface ActionInputProps {
  isYourTurn: boolean;
  isPerforming: boolean;
  suggestedActions: string[];
  onTakeAction: (action: string) => void;
  onEndTurn: (nextPlayerId?: string) => void;
  allPlayers?: Player[];
  currentPlayer?: Player | null;
}

export function ActionInput({
  isYourTurn,
  isPerforming,
  suggestedActions,
  onTakeAction,
  onEndTurn,
  allPlayers = [],
  currentPlayer,
}: ActionInputProps) {
  const [action, setAction] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [passOpen, setPassOpen] = useState(false);

  // Load voice mode preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VOICE_MODE_KEY);
      if (stored === 'true') setVoiceMode(true);
    } catch {}
  }, []);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VOICE_MODE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleTranscript = useCallback((text: string) => {
    setAction(text);
    setIsListening(false);
  }, []);

  const handlePartialTranscript = useCallback((text: string) => {
    setAction(text);
    setIsListening(true);
  }, []);

  const handleSubmit = () => {
    if (!action.trim() || isPerforming) return;
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
    if (isPerforming) return;
    onTakeAction(suggestion);
  };

  const otherPlayers = allPlayers.filter((p) => p.id !== currentPlayer?.id);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          placeholder={
            voiceMode
              ? "Tap the mic and speak your action..."
              : "What do you do? (Ctrl+Enter to submit)"
          }
          value={action}
          onChange={(e) => setAction(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPerforming}
          className={`min-h-[80px] pr-24 resize-none ${
            isYourTurn ? 'border-green-500/50 focus:border-green-500' : ''
          } ${isListening ? 'border-red-500/50' : ''}`}
        />
        <div className="absolute bottom-2 right-2 flex gap-1 items-center">
          {voiceMode && (
            <VoiceInput
              onTranscript={handleTranscript}
              onPartialTranscript={handlePartialTranscript}
              disabled={isPerforming}
            />
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!action.trim() || isPerforming}
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
        <button
          type="button"
          onClick={toggleVoiceMode}
          className="absolute top-2 right-2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={voiceMode ? 'Switch to text input' : 'Switch to voice input'}
        >
          {voiceMode ? (
            <Keyboard className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {isListening && (
        <div className="flex items-center gap-2 text-xs text-red-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          Listening...
        </div>
      )}

      {suggestedActions.length > 0 && !isPerforming && (
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

      {!isPerforming && (
        <div className="flex justify-end">
          {otherPlayers.length > 0 ? (
            <Popover open={passOpen} onOpenChange={setPassOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <SkipForward className="h-4 w-4 mr-1" />
                  Pass Turn
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { onEndTurn(); setPassOpen(false); }}
                    className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                  >
                    Next in order
                  </button>
                  {otherPlayers.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => { onEndTurn(player.id); setPassOpen(false); }}
                      className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                    >
                      {player.character_sheet?.name || player.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEndTurn()}
              className="text-muted-foreground"
            >
              <SkipForward className="h-4 w-4 mr-1" />
              Pass Turn
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
