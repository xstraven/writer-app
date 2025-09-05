'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/errors'
import { continueStory, appendSnippet, regenerateSnippet } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import type { Chunk, ContinueRequest } from '@/lib/types'

export function useStoryGeneration() {
  const { 
    chunks, 
    setChunks, 
    pushHistory, 
    currentStory,
    generationSettings,
    synopsis,
    lorebook,
    memory,
  } = useAppStore()

  // Mutation for generating story continuation (preview-only; UI decides what to do)
  const generateMutation = useMutation({
    mutationFn: async ({ instruction }: { instruction: string }) => {
      let draftText = chunks.map(c => c.text).join('\n\n')
      const windowChars = Math.max(0, Math.floor((generationSettings.max_context_window ?? 0) * 3))
      if (windowChars > 0 && draftText.length > windowChars) {
        draftText = draftText.slice(-windowChars)
      }

      const request: ContinueRequest = {
        draft_text: draftText,
        instruction,
        story: currentStory,
        max_tokens: generationSettings.max_tokens,
        temperature: generationSettings.temperature,
        model: generationSettings.model,
        system_prompt: generationSettings.system_prompt,
        use_memory: true,
        use_context: true,
        context: {
          summary: synopsis,
          npcs: [],
          objects: [],
        },
        lore_ids: lorebook.filter(l => l.always_on).map(l => l.id),
      }

      const { continuation } = await continueStory(request)
      return continuation
    },
    onError: (error: any) => {
      toast.error(`Generation failed: ${getApiErrorMessage(error)}`)
    },
  })

  // Mutation for committing user chunks to backend
  const commitChunkMutation = useMutation({
    mutationFn: async (content: string) => {
      return await appendSnippet({
        story: currentStory,
        content,
        kind: 'user',
        set_active: true,
      })
    },
    onSuccess: () => {
      toast.success("Chunk committed to story")
    },
    onError: (error) => {
      toast.error(`Failed to commit chunk: ${error.message}`)
    },
  })

  // Mutation for regenerating the last LLM chunk on the backend
  const regenerateMutation = useMutation({
    mutationFn: async ({ instruction }: { instruction: string }) => {
      const last = chunks[chunks.length - 1]
      if (!last) throw new Error('No chunk to regenerate')

      const created = await regenerateSnippet({
        story: currentStory,
        target_snippet_id: last.id,
        instruction,
        max_tokens: generationSettings.max_tokens,
        model: generationSettings.model ?? null,
        use_memory: true,
        temperature: generationSettings.temperature,
        // Pass window to backend so it can truncate server-side
        max_context_window: generationSettings.max_context_window,
        context: {
          summary: synopsis,
          npcs: [],
          objects: [],
        },
        use_context: true,
        set_active: true,
        lore_ids: lorebook.filter(l => l.always_on).map(l => l.id),
      })
      return created
    },
    onSuccess: (created) => {
      const before = [...chunks]
      const after = [...chunks]
      after[after.length - 1] = {
        id: created.id,
        text: created.content,
        author: 'llm',
        timestamp: new Date(created.created_at).getTime(),
      }
      pushHistory('regenerate', before, after)
      setChunks(after)
      toast.success('Story chunk regenerated successfully')
    },
    onError: (error: any) => {
      toast.error(`Regeneration failed: ${getApiErrorMessage(error)}`)
    },
  })

  const generateContinuation = (instruction: string) => {
    generateMutation.mutate({ instruction })
  }

  const generateContinuationAsync = (instruction: string) => {
    return generateMutation.mutateAsync({ instruction })
  }

  const regenerateLast = (instruction: string = '') => {
    regenerateMutation.mutate({ instruction })
  }

  const commitChunk = (content: string) => {
    commitChunkMutation.mutate(content)
  }

  return {
    generateContinuation,
    generateContinuationAsync,
    regenerateLast,
    commitChunk,
    isGenerating: generateMutation.isPending || regenerateMutation.isPending,
    generationError: generateMutation.error || regenerateMutation.error,
  }
}
