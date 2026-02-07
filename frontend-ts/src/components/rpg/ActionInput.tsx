'use client';

import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { Loader2, SkipForward, Dices, Mic, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { VoiceInput } from '@/components/ui/voice-input';

const VOICE_MODE_KEY = 'storycraft-voice-mode';

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
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);

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
              ? voiceMode
                ? "Tap the mic and speak your action..."
                : "What do you do? (Ctrl+Enter to submit)"
              : "Waiting for your turn..."
          }
          value={action}
          onChange={(e) => setAction(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isYourTurn || isPerforming}
          className={`min-h-[80px] pr-24 resize-none ${
            isYourTurn ? 'border-green-500/50 focus:border-green-500' : ''
          } ${isListening ? 'border-red-500/50' : ''}`}
        />
        <div className="absolute bottom-2 right-2 flex gap-1 items-center">
          {voiceMode && (
            <VoiceInput
              onTranscript={handleTranscript}
              onPartialTranscript={handlePartialTranscript}
              disabled={!isYourTurn || isPerforming}
            />
          )}
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
