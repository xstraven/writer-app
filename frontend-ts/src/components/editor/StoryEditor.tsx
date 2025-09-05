'use client'

import { useState, useMemo } from 'react'
import { Wand2, Undo2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TipTapComposer } from './TipTapComposer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChunkRenderer } from './ChunkRenderer'
import { Loading } from '@/components/ui/loading'
import { useAppStore } from '@/stores/appStore'
import { useStoryGeneration } from '@/hooks/useStoryGeneration'
import { useStorySync } from '@/hooks/useStorySync'
import { appendSnippet } from '@/lib/api'
import { uid } from '@/lib/utils'
import type { Chunk } from '@/lib/types'

export function StoryEditor() {
  const [isAddingChunk, setIsAddingChunk] = useState(false)
  const [userDraft, setUserDraft] = useState('')
  
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
  } = useAppStore()

  const { 
    generateContinuation, 
    generateContinuationAsync,
    isGenerating, 
    generationError 
  } = useStoryGeneration()

  // Sync with backend story data
  const { isLoading: isSyncing, error: syncError, refetch: refetchStory } = useStorySync()

  const draftText = useMemo(() => chunks.map(c => c.text).join(' '), [chunks])

  const DEFAULT_INSTRUCTION = "Continue the story, matching established voice, tone, and point of view. Maintain continuity with prior events and details."
  const handleGenerate = async (maybeText?: string) => {
    const raw = (maybeText ?? instruction)
    const text = raw.trim() || DEFAULT_INSTRUCTION
    try {
      // If user didn't provide custom instruction, pass empty so backend applies base instruction
      const payloadInstr = (text === DEFAULT_INSTRUCTION) ? '' : text
      const continuation = await generateContinuationAsync(payloadInstr)
      // Clear instruction box after generate (placeholder shows default)
      setInstruction('')
      // Append to the active user draft (with a space if needed)
      setUserDraft((prev) => {
        if (!prev) return continuation
        const needsSpace = /\S$/.test(prev)
        return needsSpace ? prev + ' ' + continuation : prev + continuation
      })
    } catch (e) {
      // Error toast is handled in hook
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
      const created = await appendSnippet({
        story: currentStory,
        content: text,
        kind: 'user',
        set_active: true,
      })

      // Replace optimistic ID/timestamp with server values without refetching
      updateChunk(optimistic.id, {
        id: created.id,
        text: created.content,
        timestamp: new Date(created.created_at).getTime(),
      })

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

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Draft</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[72vh] rounded-2xl border bg-white px-3 py-3">
          <div className="space-y-3">
            {isSyncing && chunks.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loading text="Loading story..." />
              </div>
            ) : (
              <>
                {chunks.map((chunk, idx) => (
                  <ChunkRenderer
                    key={chunk.id}
                    chunk={chunk}
                    index={idx}
                  />
                ))}

                {chunks.length === 0 && (
                  <div className="text-center py-8 text-neutral-500">
                    <p>No story content yet.</p>
                    <p className="text-sm">Start writing below or load an existing story.</p>
                  </div>
                )}

                {/* Active user draft chunk */}
                <div className="mt-3">
                  <label className="text-sm text-neutral-600">
                    Your next chunk (Cmd/Ctrl+Enter to save)
                  </label>
                  <div className="mt-2">
                    <TipTapComposer
                      value={userDraft}
                      onChange={setUserDraft}
                      onSubmit={handleSubmitUserChunk}
                      placeholder="Write your next chunk..."
                      disabled={isGenerating || isAddingChunk}
                      className="min-h-[96px]"
                    />
                  </div>
                  {/* Inline status: saving or generating */}
                  <div className="mt-2 h-5 text-xs text-neutral-500 flex items-center gap-2" aria-live="polite">
                    {isAddingChunk ? (
                      <>
                        <Loading size="sm" className="mr-1" /> Saving...
                      </>
                    ) : isGenerating ? (
                      <>
                        <Loading size="sm" className="mr-1" /> Generating...
                      </>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Instruction Box with TipTap */}
        <div className="mt-4">
          <label htmlFor="instruction" className="text-sm text-neutral-600">
            Instruction to model (Press Cmd/Ctrl+Enter to generate)
          </label>
          <div className="mt-2">
            <TipTapComposer
              value={instruction}
              onChange={setInstruction}
              onSubmit={handleGenerate}
              placeholder={DEFAULT_INSTRUCTION}
              disabled={isGenerating}
              className="min-h-[72px]"
            />
          </div>
        </div>

        {/* Command Bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => handleGenerate()}
            disabled={isGenerating}
          >
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
          {/* Regenerate button hidden for now */}
          <Button 
            variant="ghost" 
            onClick={handleRevert} 
            disabled={history.length === 0 || isGenerating}
          >
            <Undo2 className="h-4 w-4 mr-2" /> Revert last action
          </Button>
        </div>

        {/* Error Display */}
        {(generationError || syncError) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <div>
                {generationError && (
                  <>
                    <p className="text-sm font-medium text-red-800">Generation failed</p>
                    <p className="text-xs text-red-600 mt-1">
                      {generationError.message}
                    </p>
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
      </CardContent>
    </Card>
  )
}
