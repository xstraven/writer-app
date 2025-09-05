'use client'

import { useState, useMemo } from 'react'
import { Wand2, RefreshCcw, Undo2, Plus, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { TipTapComposer } from './TipTapComposer'
import { AddChunkModal } from './AddChunkModal'
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
  const [showAddChunkModal, setShowAddChunkModal] = useState(false)
  const [isAddingChunk, setIsAddingChunk] = useState(false)
  
  const {
    chunks,
    instruction,
    setInstruction,
    addChunk,
    setChunks,
    history,
    revertFromHistory,
    pushHistory,
    currentStory,
  } = useAppStore()

  const { 
    generateContinuation, 
    regenerateLast, 
    isGenerating, 
    generationError 
  } = useStoryGeneration()

  // Sync with backend story data
  const { isLoading: isSyncing, error: syncError, refetch: refetchStory } = useStorySync()

  const draftText = useMemo(() => chunks.map(c => c.text).join(' '), [chunks])

  const handleGenerate = () => {
    if (instruction.trim()) {
      generateContinuation(instruction)
      setInstruction('')
    } else {
      toast.error("Please enter an instruction first")
    }
  }

  const handleRegenerateLast = () => {
    if (chunks.length === 0) return
    regenerateLast()
  }

  const handleRevert = () => {
    revertFromHistory()
    toast.success("Reverted to previous state")
  }

  const handleAddUserText = async (userText: string) => {
    setIsAddingChunk(true)
    
    try {
      // Add to backend first
      await appendSnippet({
        story: currentStory,
        content: userText,
        kind: 'user',
        set_active: true,
      })
      
      // Refresh story data to sync the new chunk from backend
      setTimeout(() => {
        refetchStory()
      }, 500) // Small delay to ensure backend has processed the request
      
      toast.success("User chunk added to story")
    } catch (error) {
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
        <ScrollArea className="h-[44vh] rounded-2xl border bg-white p-4">
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

                {/* Add user chunk */}
                <Button 
                  onClick={() => setShowAddChunkModal(true)} 
                  variant="secondary" 
                  className="mt-1"
                  disabled={isGenerating || isAddingChunk}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add user chunk
                </Button>
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
              placeholder="e.g., Continue in a tense, noir voice. Focus on atmosphere; add subtle foreshadowing."
              disabled={isGenerating}
              className="min-h-[72px]"
            />
          </div>
        </div>

        {/* Command Bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button 
            onClick={handleGenerate}
            disabled={isGenerating || !instruction.trim()}
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
          <Button 
            variant="outline" 
            onClick={handleRegenerateLast}
            disabled={isGenerating || chunks.length === 0}
          >
            {isGenerating ? (
              <Loading size="sm" className="mr-2" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            Regenerate last chunk
          </Button>
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