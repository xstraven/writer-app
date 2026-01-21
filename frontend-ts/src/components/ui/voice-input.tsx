'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onPartialTranscript?: (text: string) => void;
  disabled?: boolean;
  className?: string;
  continuous?: boolean;
  language?: string;
}

// Check if the browser supports the Web Speech API
const isSpeechRecognitionSupported = () => {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
};

export function VoiceInput({
  onTranscript,
  onPartialTranscript,
  disabled = false,
  className,
  continuous = true,
  language = 'en-US',
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || disabled) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      finalTranscriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
        onTranscript(finalTranscriptRef.current);
      }

      if (interimTranscript && onPartialTranscript) {
        onPartialTranscript(finalTranscriptRef.current + interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Send final transcript if we have any accumulated text
      if (finalTranscriptRef.current) {
        onTranscript(finalTranscriptRef.current);
      }
    };

    recognition.start();
  }, [isSupported, disabled, continuous, language, onTranscript, onPartialTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (!isSupported) {
    return null; // Don't show button if not supported
  }

  return (
    <Button
      type="button"
      variant={isListening ? 'default' : 'outline'}
      size="icon"
      onClick={toggleListening}
      disabled={disabled}
      className={cn(
        'transition-all',
        isListening && 'bg-red-500 hover:bg-red-600 animate-pulse',
        className
      )}
      title={isListening ? 'Stop recording' : 'Start voice input'}
    >
      {isListening ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
