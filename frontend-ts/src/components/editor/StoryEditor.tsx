'use client'

import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Wand2, Undo2, AlertCircle } from 'lucide-react'
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

export function StoryEditor() {
  const [isAddingChunk, setIsAddingChunk] = useState(false)
  const [userDraft, setUserDraft] = useState('')
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
      // Append continuation to the last chunk directly in continuous editor mode
      if (chunks.length > 0) {
        const last = chunks[chunks.length - 1]
        const needsBreak = last.text && !/\n\n$/.test(last.text)
        const newText = needsBreak ? last.text + '\n\n' + continuation : last.text + continuation
        updateChunk(last.id, { text: newText, timestamp: Date.now() })
        // Best-effort persist
        try {
          const { updateSnippet } = await import('@/lib/api')
          await updateSnippet(last.id, { content: newText, kind: last.author === 'user' ? 'user' : 'ai' })
        } catch {}
      }
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
        <label htmlFor="instruction" className="block mb-2 text-sm text-neutral-600">
          Instruction to model (Press Cmd/Ctrl+Enter to generate)
        </label>
        <div className="relative" aria-busy={isGenerating}>
          {isGenerating && (
            <div className="absolute inset-0 rounded-md bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center" aria-hidden="true">
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
