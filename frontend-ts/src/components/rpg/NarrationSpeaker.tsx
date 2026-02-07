'use client';

import { Volume2, VolumeX, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NarrationSpeakerProps {
  isSpeaking: boolean;
  isPaused: boolean;
  onSpeak: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function NarrationSpeaker({
  isSpeaking,
  isPaused,
  onSpeak,
  onPause,
  onResume,
  onStop,
}: NarrationSpeakerProps) {
  if (isSpeaking) {
    return (
      <span className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            isPaused ? onResume() : onPause();
          }}
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? (
            <Play className="h-3 w-3" />
          ) : (
            <Pause className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
          title="Stop"
        >
          <VolumeX className="h-3 w-3" />
        </Button>
        <span className="flex gap-0.5 items-center ml-0.5">
          <span className="h-1.5 w-0.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="h-2 w-0.5 rounded-full bg-amber-500 animate-pulse [animation-delay:150ms]" />
          <span className="h-1 w-0.5 rounded-full bg-amber-500 animate-pulse [animation-delay:300ms]" />
        </span>
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => {
        e.stopPropagation();
        onSpeak();
      }}
      title="Read aloud"
    >
      <Volume2 className="h-3 w-3" />
    </Button>
  );
}
