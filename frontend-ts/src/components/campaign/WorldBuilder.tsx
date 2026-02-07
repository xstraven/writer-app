'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  MapPin,
  Users,
  Scroll,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VoiceInput } from '@/components/ui/voice-input';
import { analyzeWorld, expandWorld } from '@/lib/api';
import type {
  WorldQuestion,
  WorldAnalysisResponse,
  WorldExpandResponse,
  ProposedLoreEntry,
} from '@/lib/types';

interface WorldBuilderProps {
  worldDescription: string;
  tone: string;
  style: string;
  onComplete: (enrichedDescription: string, acceptedEntries: ProposedLoreEntry[]) => void;
  onCancel: () => void;
}

interface AnsweredQuestion {
  question: WorldQuestion;
  answer: string;
  collapsed: boolean;
}

const CATEGORY_ICONS: Record<string, typeof MapPin> = {
  setting: MapPin,
  conflict: Sparkles,
  faction: Users,
  culture: Scroll,
  magic: Sparkles,
  history: Scroll,
  character: Users,
};

const CATEGORY_COLORS: Record<string, string> = {
  conflict: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  setting: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  culture: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  magic: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  history: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  faction: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  character: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
};

export function WorldBuilder({
  worldDescription,
  tone,
  style,
  onComplete,
  onCancel,
}: WorldBuilderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [isExpanding, setIsExpanding] = useState(false);
  const [summary, setSummary] = useState('');
  const [detectedGenre, setDetectedGenre] = useState('');
  const [detectedThemes, setDetectedThemes] = useState<string[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<WorldQuestion[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [proposedEntries, setProposedEntries] = useState<ProposedLoreEntry[]>([]);
  const [acceptedEntries, setAcceptedEntries] = useState<Set<string>>(new Set());
  const [enrichedDescription, setEnrichedDescription] = useState('');
  const [worldSummary, setWorldSummary] = useState<Record<string, string>>({});
  const [round, setRound] = useState(0);
  const [visibleQuestions, setVisibleQuestions] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial analysis
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result: WorldAnalysisResponse = await analyzeWorld({
          world_description: worldDescription,
          tone,
          style,
        });
        if (cancelled) return;
        setSummary(result.summary);
        setDetectedGenre(result.detected_genre);
        setDetectedThemes(result.detected_themes);
        setCurrentQuestions(result.questions);
        setProposedEntries(result.proposed_entries);
        // Auto-accept all initial entries
        setAcceptedEntries(new Set(result.proposed_entries.map((e) => e.name)));
        setRound(1);
      } catch (err) {
        console.error('World analysis failed:', err);
        setSummary('I had trouble analyzing your world. You can still continue with your description as-is.');
      } finally {
        if (!cancelled) setIsAnalyzing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [worldDescription, tone, style]);

  // Staggered reveal of questions
  useEffect(() => {
    if (currentQuestions.length === 0 || visibleQuestions >= currentQuestions.length) return;
    const timer = setTimeout(() => {
      setVisibleQuestions((v) => v + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [currentQuestions, visibleQuestions]);

  // Reset visible count when new questions arrive
  useEffect(() => {
    setVisibleQuestions(0);
  }, [round]);

  // Scroll to bottom when new content appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleQuestions, answeredQuestions, isExpanding]);

  const handleAnswer = (questionId: string, value: string) => {
    setCurrentAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleExpandWorld = async () => {
    // Collect answers (skip empty)
    const filledAnswers: Record<string, string> = {};
    for (const q of currentQuestions) {
      const answer = currentAnswers[q.id]?.trim();
      if (answer) {
        filledAnswers[q.id] = answer;
      }
    }

    if (Object.keys(filledAnswers).length === 0) return;

    // Move current questions to answered
    const newAnswered: AnsweredQuestion[] = currentQuestions
      .filter((q) => filledAnswers[q.id])
      .map((q) => ({
        question: q,
        answer: filledAnswers[q.id],
        collapsed: true,
      }));

    setAnsweredQuestions((prev) => [...prev, ...newAnswered]);
    setCurrentQuestions([]);
    setCurrentAnswers({});
    setIsExpanding(true);

    try {
      const result: WorldExpandResponse = await expandWorld({
        world_description: enrichedDescription || worldDescription,
        answers: filledAnswers,
        tone,
        style,
      });

      setEnrichedDescription(result.enriched_description);
      setCurrentQuestions(result.follow_up_questions);
      setWorldSummary(result.world_summary);

      // Add new proposed entries
      const newEntries = result.proposed_entries.filter(
        (e) => !proposedEntries.some((existing) => existing.name === e.name)
      );
      setProposedEntries((prev) => [...prev, ...newEntries]);
      // Auto-accept new entries
      setAcceptedEntries((prev) => {
        const next = new Set(prev);
        newEntries.forEach((e) => next.add(e.name));
        return next;
      });
      setRound((r) => r + 1);
    } catch (err) {
      console.error('World expansion failed:', err);
    } finally {
      setIsExpanding(false);
    }
  };

  const toggleEntry = (name: string) => {
    setAcceptedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleCollapse = (index: number) => {
    setAnsweredQuestions((prev) =>
      prev.map((aq, i) =>
        i === index ? { ...aq, collapsed: !aq.collapsed } : aq
      )
    );
  };

  const handleDone = () => {
    const accepted = proposedEntries.filter((e) => acceptedEntries.has(e.name));
    onComplete(enrichedDescription || worldDescription, accepted);
  };

  const totalQuestions = answeredQuestions.length + currentQuestions.length;
  const answeredCount = answeredQuestions.length;
  const filledCount = Object.values(currentAnswers).filter((a) => a.trim()).length;

  const kindIcon = (kind: string) => {
    switch (kind) {
      case 'location': return <MapPin className="h-3 w-3" />;
      case 'faction': return <Users className="h-3 w-3" />;
      case 'character': return <Users className="h-3 w-3" />;
      default: return <Scroll className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            World Builder
          </h3>
          <p className="text-sm text-muted-foreground">
            Let's flesh out your world together
          </p>
        </div>
        {totalQuestions > 0 && (
          <div className="text-sm text-muted-foreground">
            {answeredCount} of {totalQuestions} questions answered
          </div>
        )}
      </div>

      {/* Progress bar */}
      {totalQuestions > 0 && (
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(5, (answeredCount / Math.max(totalQuestions, 1)) * 100)}%` }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main conversation area */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <div
                ref={scrollRef}
                className="space-y-4 max-h-[500px] overflow-y-auto pr-2"
              >
                {/* Loading state */}
                {isAnalyzing && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Reading your world...</p>
                      <p className="text-xs text-muted-foreground">The AI is analyzing your setting</p>
                    </div>
                  </div>
                )}

                {/* AI Summary */}
                {summary && !isAnalyzing && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <MessageCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="space-y-2">
                        <p className="text-sm">{summary}</p>
                        {detectedGenre && (
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary">{detectedGenre}</Badge>
                            {detectedThemes.map((theme) => (
                              <Badge key={theme} variant="outline" className="text-xs">
                                {theme}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Previously answered questions */}
                {answeredQuestions.map((aq, index) => (
                  <div key={`answered-${index}`} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(index)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                    >
                      {aq.collapsed ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronUp className="h-3 w-3 shrink-0" />
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${CATEGORY_COLORS[aq.question.category] || ''}`}
                      >
                        {aq.question.category}
                      </Badge>
                      <span className="truncate">{aq.question.question}</span>
                    </button>
                    {!aq.collapsed && (
                      <div className="ml-5 space-y-1">
                        <p className="text-sm p-2 rounded bg-muted/50 italic">
                          {aq.question.question}
                        </p>
                        <p className="text-sm p-2 rounded bg-primary/5">
                          {aq.answer}
                        </p>
                      </div>
                    )}
                    {aq.collapsed && (
                      <p className="ml-5 text-xs text-muted-foreground truncate">
                        {aq.answer}
                      </p>
                    )}
                  </div>
                ))}

                {/* Current questions */}
                {currentQuestions.slice(0, visibleQuestions).map((q) => {
                  const Icon = CATEGORY_ICONS[q.category] || MessageCircle;
                  return (
                    <div
                      key={q.id}
                      className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 text-primary mt-1 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${CATEGORY_COLORS[q.category] || ''}`}
                            >
                              {q.category}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{q.question}</p>
                          <div className="flex gap-2">
                            <Textarea
                              placeholder={q.placeholder}
                              value={currentAnswers[q.id] || ''}
                              onChange={(e) => handleAnswer(q.id, e.target.value)}
                              className="min-h-[60px] text-sm resize-none"
                              rows={2}
                            />
                            <VoiceInput
                              onTranscript={(text) => handleAnswer(q.id, text)}
                              onPartialTranscript={(text) => handleAnswer(q.id, text)}
                              className="shrink-0 self-end"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Expanding state */}
                {isExpanding && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Weaving your answers into the world...</p>
                      <p className="text-xs text-muted-foreground">Building a richer setting</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {!isAnalyzing && currentQuestions.length > 0 && (
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button
                    onClick={handleExpandWorld}
                    disabled={isExpanding || filledCount === 0}
                    className="flex-1"
                  >
                    {isExpanding ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Expanding...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Expand World ({filledCount} answer{filledCount !== 1 ? 's' : ''})
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleDone}>
                    Done
                  </Button>
                </div>
              )}

              {/* Done state (no more questions) */}
              {!isAnalyzing && !isExpanding && currentQuestions.length === 0 && answeredQuestions.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Button onClick={handleDone} className="w-full">
                    <Check className="mr-2 h-4 w-4" />
                    Use This World
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: World Overview + Proposed Entries */}
        <div className="space-y-4">
          {/* World Summary */}
          {Object.keys(worldSummary).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">World Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
                {Object.entries(worldSummary).map(([section, content]) => (
                  <div key={section}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {section}
                    </p>
                    <p className="text-xs mt-0.5">{content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Proposed Lorebook Entries */}
          {proposedEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  World Elements ({acceptedEntries.size}/{proposedEntries.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {proposedEntries.map((entry) => {
                  const isAccepted = acceptedEntries.has(entry.name);
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => toggleEntry(entry.name)}
                      className={`w-full text-left p-2 rounded-md border text-xs transition-all ${
                        isAccepted
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {kindIcon(entry.kind)}
                          <span className="font-medium">{entry.name}</span>
                        </div>
                        {isAccepted ? (
                          <Check className="h-3 w-3 text-primary" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {entry.reason}
                      </p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="outline" onClick={handleDone}>
          {enrichedDescription ? 'Use Enriched World' : 'Skip & Use Original'}
        </Button>
      </div>
    </div>
  );
}
