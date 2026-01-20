'use client'

import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Wand2, Undo2, AlertCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TipTapComposer } from './TipTapComposer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChunkRenderer } from './ChunkRenderer'
// import { ContinuousEditor } from './ContinuousEditor'
import { Loading } from '@/components/ui/loading'
import { useAppStore } from '@/stores/appStore'
import { useStoryGeneration } from '@/hooks/useStoryGeneration'
import { useStorySync } from '@/hooks/useStorySync'
import { appendSnippet } from '@/lib/api'
import { uid } from '@/lib/utils'
import type { Chunk } from '@/lib/types'
import { Input } from '@/components/ui/input'

const SUGGESTION_LINE_PATTERN = /^(?:\d+[\).]\s+|[-•–]\s+)/

function extractSuggestions(answer: string): string[] {
  const lines = answer
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  const suggestions: string[] = []
  let current = ''

  for (const line of lines) {
    if (SUGGESTION_LINE_PATTERN.test(line)) {
      if (current) {
        suggestions.push(current.trim())
      }
      current = line.replace(SUGGESTION_LINE_PATTERN, '').trim()
    } else if (line.match(/^(?:Suggestion|Option|Idea)\s*\d*[:.-]/i)) {
      if (current) {
        suggestions.push(current.trim())
      }
      current = line.replace(/^(?:Suggestion|Option|Idea)\s*\d*[:.-]\s*/i, '').trim()
    } else {
      current = current ? `${current} ${line}` : line
    }
  }

  if (current) {
    suggestions.push(current.trim())
  }

  if (suggestions.length === 0) {
    return [answer.trim()]
  }

  return suggestions
}

export function StoryEditor() {
  const [isAddingChunk, setIsAddingChunk] = useState(false)
  const [userDraft, setUserDraft] = useState('')
  const [ideaQuestion, setIdeaQuestion] = useState('')
  const [ideaLog, setIdeaLog] = useState<
    Array<{ id: string; question: string; answer: string; suggestions: string[]; isCollapsed: boolean }>
  >([])
  const queryClient = useQueryClient()
  
  const {
    chunks,
    instruction,
    setInstruction,
    addChunk,
    updateChunk,
    setChunks,
    history,
    revertFromHistory,
    pushHistory,
    currentStory,
    currentBranch,
    generationSettings,
  } = useAppStore()

  const { 
    generateContinuationAsync,
    isGenerating, 
    generationError,
    askForIdea,
    isThinkingIdea,
  } = useStoryGeneration()

  // Sync with backend story data
  const { isLoading: isSyncing, error: syncError, refetch: refetchStory } = useStorySync()

  const draftText = useMemo(() => chunks.map(c => c.text).join(' '), [chunks])

  const DEFAULT_INSTRUCTION = generationSettings.base_instruction || 'Continue the story, matching established voice, tone, and point of view. Maintain continuity with prior events and details.'

  const handleGenerate = async (maybeText?: string) => {
    const userInstr = (maybeText ?? instruction).trim()
    // Merge base instruction with user instruction if provided
    const payloadInstr = userInstr ? `${DEFAULT_INSTRUCTION}\n\n${userInstr}` : DEFAULT_INSTRUCTION

    let continuation: string
    try {
      continuation = await generateContinuationAsync(payloadInstr)
    } catch (error) {
      // Hook already emitted an error toast
      return
    }

    if (!continuation.trim()) {
      toast.error('Model returned empty continuation')
      return
    }

    // Keep instruction persistent between generations
    // Removed: setInstruction('')

    const { chunks: currentChunks } = useAppStore.getState()
    const parentId = currentChunks.length > 0 ? currentChunks[currentChunks.length - 1].id : null

    try {
      const created = await appendSnippet({
        story: currentStory,
        content: continuation,
        kind: 'ai',
        parent_id: parentId,
        set_active: true,
        branch: currentBranch,
      })

      const before = useAppStore.getState().chunks.map(item => ({ ...item }))
      const newChunk: Chunk = {
        id: created.id,
        text: created.content,
        author: 'llm',
        timestamp: new Date(created.created_at).getTime(),
      }
      const after = [...before, newChunk]
      pushHistory('generate', before, after.map(item => ({ ...item })))
      setChunks(after)

      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory, currentBranch] })
      toast.success('Generated new chunk')
    } catch (error) {
      console.error('Failed to append generated chunk:', error)
      toast.error(`Failed to save generated chunk: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Regenerate temporarily disabled (button hidden)

  const handleRevert = () => {
    revertFromHistory()
    toast.success("Reverted to previous state")
  }

  const handleSubmitUserChunk = async (maybeText?: string) => {
    const text = (maybeText ?? userDraft).trim()
    if (!text) {
      toast.error('Please write something before saving')
      return
    }

    setIsAddingChunk(true)

    // Optimistically add to the draft
    const optimistic: Chunk = {
      id: uid(),
      text,
      author: 'user',
      timestamp: Date.now(),
    }
    addChunk(optimistic)
    const previousDraft = userDraft
    setUserDraft('')

    try {
      const parentId = chunks.length > 0 ? chunks[chunks.length - 1].id : null
      const created = await appendSnippet({
        story: currentStory,
        content: text,
        kind: 'user',
        parent_id: parentId,
        set_active: true,
        branch: currentBranch,
      })

      // Replace optimistic ID/timestamp with server values without refetching
      updateChunk(optimistic.id, {
        id: created.id,
        text: created.content,
        timestamp: new Date(created.created_at).getTime(),
      })

      // Invalidate branch to refresh any downstream consumers and ensure consistency
      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory, currentBranch] })

      toast.success('Chunk added')
    } catch (error) {
      // Revert optimistic add and restore draft
      setChunks(chunks.filter(c => c.id !== optimistic.id))
      setUserDraft(previousDraft)
      console.error('Failed to add user chunk:', error)
      toast.error(`Failed to add chunk: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsAddingChunk(false)
    }
  }

  const handleAskIdea = async () => {
    const prompt = ideaQuestion.trim()
    if (!prompt) {
      toast.error('Please enter a question')
      return
    }
    try {
      const answer = await askForIdea(prompt)
      if (answer && answer.trim()) {
        const cleanedAnswer = answer.trim()
        const suggestions = extractSuggestions(cleanedAnswer)
        setIdeaLog((prev) => [
          ...prev,
          {
            id: uid(),
            question: prompt,
            answer: cleanedAnswer,
            suggestions,
            isCollapsed: false,
          },
        ])
      } else {
        toast.error('The assistant did not return an answer')
      }
      setIdeaQuestion('')
    } catch (error) {
      // Error toast already handled inside hook
    }
  }

  const handleAddSuggestionToInstruction = (suggestion: string) => {
    const textToInsert = suggestion.trim()
    if (!textToInsert) {
      return
    }
    const currentInstruction = instruction
    if (currentInstruction.trim().length === 0) {
      setInstruction(textToInsert)
    } else {
      const trimmedEnd = currentInstruction.replace(/\s+$/, '')
      const separator = trimmedEnd.endsWith('\n') ? '' : '\n\n'
      setInstruction(`${trimmedEnd}${separator}${textToInsert}`)
    }
    toast.success('Suggestion added to prompt')
  }

  const handleToggleSuggestionVisibility = (entryId: string) => {
    setIdeaLog(prev =>
      prev.map(entry =>
        entry.id === entryId ? { ...entry, isCollapsed: !entry.isCollapsed } : entry,
      ),
    )
  }

  const handleDeleteSuggestion = (entryId: string, suggestionIndex: number) => {
    setIdeaLog(prev =>
      prev.map(entry => {
        if (entry.id !== entryId) {
          return entry
        }
        const nextSuggestions = entry.suggestions.filter((_, index) => index !== suggestionIndex)
        return {
          ...entry,
          suggestions: nextSuggestions,
        }
      }),
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <ScrollArea className="h-[74vh] rounded-2xl border border-neutral-200 bg-white px-5 py-5">
          <div className="space-y-3">
            {isSyncing && chunks.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loading text="Loading story..." />
              </div>
            ) : (
              <>
                {chunks.map((chunk, index) => (
                  <ChunkRenderer key={chunk.id} chunk={chunk} index={index} />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Instruction Box with TipTap */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="instruction" className="text-sm text-neutral-600">
            Instruction to model (Press Cmd/Ctrl+Enter to generate)
          </label>
          <button
            type="button"
            onClick={() => setInstruction('')}
            disabled={isGenerating || !instruction.trim()}
            className="text-xs text-neutral-500 hover:text-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
        <div className="relative" aria-busy={isGenerating}>
          {isGenerating && (
            <div className="absolute inset-0 rounded-md bg-white/60 dark:bg-neutral-900/70 backdrop-blur-[1px] z-10 flex items-center justify-center" aria-hidden="true">
              <Loading size="md" text="Generating..." />
            </div>
          )}
          <TipTapComposer
            value={instruction}
            onChange={setInstruction}
            onSubmit={handleGenerate}
            placeholder={DEFAULT_INSTRUCTION}
            disabled={isGenerating}
            className="min-h-[84px]"
          />
        </div>
      </div>

      {/* Command Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => handleGenerate()} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loading size="sm" className="mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Generate continuation
            </>
          )}
        </Button>
        <Button variant="ghost" onClick={handleRevert} disabled={history.length === 0 || isGenerating}>
          <Undo2 className="h-4 w-4 mr-2" /> Revert last action
        </Button>
      </div>

      {/* Idea Assistant */}
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-700">Need ideas on what happens next?</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={ideaQuestion}
            onChange={(e) => setIdeaQuestion(e.target.value)}
            placeholder="Ask for suggestions, e.g. How should the hero confront the villain?"
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAskIdea()
              }
            }}
            disabled={isThinkingIdea}
          />
          <Button
            onClick={handleAskIdea}
            disabled={isThinkingIdea || !ideaQuestion.trim()}
            className="shrink-0"
          >
            {isThinkingIdea ? (
              <>
                <Loading size="sm" className="mr-2" />
                Thinking...
              </>
            ) : (
              'Ask'
            )}
          </Button>
        </div>
        {ideaLog.length > 0 && (
          <div className="space-y-3 text-sm">
            {ideaLog.map((entry) => (
              <div key={entry.id} className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium text-neutral-800">Q: {entry.question}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="self-start sm:self-auto"
                    onClick={() => handleToggleSuggestionVisibility(entry.id)}
                  >
                    {entry.isCollapsed ? (
                      <>
                        <ChevronDown className="mr-2 h-4 w-4" /> Show suggestions
                      </>
                    ) : (
                      <>
                        <ChevronUp className="mr-2 h-4 w-4" /> Hide suggestions
                      </>
                    )}
                  </Button>
                </div>
                {!entry.isCollapsed && (
                  <div className="space-y-2">
                    {entry.suggestions.length > 0 ? (
                      entry.suggestions.map((suggestion, index) => (
                        <div
                          key={`${entry.id}-${index}`}
                          className="flex flex-col gap-2 rounded border border-neutral-200 bg-neutral-50 p-2 sm:flex-row sm:items-start"
                        >
                          <div className="flex-1 whitespace-pre-wrap text-neutral-700">{suggestion}</div>
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAddSuggestionToInstruction(suggestion)}
                            >
                              Add to prompt
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteSuggestion(entry.id, index)}
                              aria-label="Delete suggestion"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs italic text-neutral-500">No suggestions remaining.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Display */}
      {(generationError || syncError) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <div>
              {generationError && (
                <>
                  <p className="text-sm font-medium text-red-800">Generation failed</p>
                  <p className="text-xs text-red-600 mt-1">{generationError.message}</p>
                </>
              )}
              {syncError && (
                <>
                  <p className="text-sm font-medium text-red-800">Story sync failed</p>
                  <p className="text-xs text-red-600 mt-1">
                    {syncError instanceof Error ? syncError.message : 'Failed to load story data'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
