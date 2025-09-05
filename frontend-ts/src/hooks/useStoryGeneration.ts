'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { continueStory, appendSnippet, getBranchPath } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import { uid } from '@/lib/utils'
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

  // Mutation for generating story continuation
  const generateMutation = useMutation({
    mutationFn: async ({ instruction, isRegeneration = false }: { instruction: string, isRegeneration?: boolean }) => {
      const draftText = chunks.map(c => c.text).join('\n\n')
      
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

      const response = await continueStory(request)
      return response
    },
    onSuccess: (data, { isRegeneration }) => {
      const newChunk: Chunk = {
        id: uid(),
        text: data.continuation,
        author: "llm",
        timestamp: Date.now(),
      }

      const before = [...chunks]
      let after: Chunk[]

      if (isRegeneration && chunks.length > 0) {
        // Replace the last chunk
        after = [...chunks.slice(0, -1), newChunk]
        pushHistory("regenerate", before, after)
        toast.success("Story chunk regenerated successfully")
      } else {
        // Add new chunk
        after = [...chunks, newChunk]
        pushHistory("generate", before, after)
        toast.success("Story continued successfully")
      }

      setChunks(after)
    },
    onError: (error) => {
      toast.error(`Generation failed: ${error.message}`)
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

  // Query to load story branch from backend
  const { data: branchData, refetch: refetchBranch } = useQuery({
    queryKey: ['branch', currentStory],
    queryFn: () => getBranchPath(currentStory),
    enabled: !!currentStory,
  })

  const generateContinuation = (instruction: string) => {
    generateMutation.mutate({ instruction })
  }

  const regenerateLast = (instruction: string = '') => {
    generateMutation.mutate({ instruction, isRegeneration: true })
  }

  const commitChunk = (content: string) => {
    commitChunkMutation.mutate(content)
  }

  return {
    generateContinuation,
    regenerateLast,
    commitChunk,
    isGenerating: generateMutation.isPending,
    generationError: generateMutation.error,
    branchData,
    refetchBranch,
  }
}