'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/errors'
import { continueStory, appendSnippet, regenerateSnippet } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import type { Chunk, ContinueRequest } from '@/lib/types'

export function useStoryGeneration() {
  const queryClient = useQueryClient()
  const { 
    chunks, 
    setChunks, 
    pushHistory, 
    currentStory,
    currentBranch,
    generationSettings,
    synopsis,
    lorebook,
    context,
  } = useAppStore()

  const buildEffectiveContext = () => {
    if (context) {
      return {
        summary: (context.summary && context.summary.trim()) || synopsis,
        npcs: [...context.npcs],
        objects: [...context.objects],
      }
    }
    return {
      summary: synopsis,
      npcs: [],
      objects: [],
    }
  }

  const buildDraftText = () => {
    let draftText = chunks.map(c => c.text).join('\n\n')
    const windowChars = Math.max(0, Math.floor((generationSettings.max_context_window ?? 0) * 3))
    if (windowChars > 0 && draftText.length > windowChars) {
      draftText = draftText.slice(-windowChars)
    }
    return draftText
  }

  // Mutation for generating story continuation (preview-only; UI decides what to do)
  const generateMutation = useMutation({
    mutationFn: async ({ instruction }: { instruction: string }) => {
      const draftText = buildDraftText()
      const effectiveContext = buildEffectiveContext()

      const request: ContinueRequest = {
        draft_text: draftText,
        // If empty, backend applies base instruction; if provided, backend merges base+user
        instruction,
        story: currentStory,
        max_tokens: generationSettings.max_tokens,
        temperature: generationSettings.temperature,
        model: generationSettings.model,
        system_prompt: generationSettings.system_prompt,
        use_memory: true,
        use_context: true,
        // Preview-only: do not persist on backend; UI handles results
        preview_only: true,
        context: effectiveContext,
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
      const parentId = chunks.length > 0 ? chunks[chunks.length - 1].id : null
      return await appendSnippet({
        story: currentStory,
        content,
        kind: 'user',
        parent_id: parentId,
        set_active: true,
        branch: currentBranch,
      })
    },
    onSuccess: () => {
      toast.success("Chunk committed to story")
      // Keep readers (like useStorySync) in sync
      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory, currentBranch] })
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

      const effectiveContext = buildEffectiveContext()

      const created = await regenerateSnippet({
        story: currentStory,
        target_snippet_id: last.id,
        // If empty, backend applies base; else merges base+user
        instruction,
        max_tokens: generationSettings.max_tokens,
        model: generationSettings.model ?? null,
        use_memory: true,
        temperature: generationSettings.temperature,
        // Pass window to backend so it can truncate server-side
        max_context_window: generationSettings.max_context_window,
        context: effectiveContext,
        use_context: true,
        set_active: true,
        lore_ids: lorebook.filter(l => l.always_on).map(l => l.id),
        branch: currentBranch,
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
      // Ensure main/branch path reflects server-selected child, etc.
      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory, currentBranch] })
      toast.success('Story chunk regenerated successfully')
    },
    onError: (error: any) => {
      toast.error(`Regeneration failed: ${getApiErrorMessage(error)}`)
    },
  })

  const ideaMutation = useMutation({
    mutationFn: async (question: string) => {
      const prompt = question.trim()
      if (!prompt) throw new Error('Question is required')
      const draftText = buildDraftText()
      const effectiveContext = buildEffectiveContext()

      const response = await continueStory({
        draft_text: draftText,
        instruction: `Answer the user's question about the story. Respond with helpful ideas, not narrative. Question: ${prompt}`,
        story: currentStory,
        max_tokens: Math.max(128, generationSettings.max_tokens),
        temperature: generationSettings.temperature,
        model: generationSettings.model,
        system_prompt: generationSettings.system_prompt,
        use_memory: true,
        use_context: true,
        preview_only: true,
        context: effectiveContext,
        lore_ids: lorebook.filter(l => l.always_on).map(l => l.id),
      })

      return response.continuation
    },
    onError: (error: any) => {
      toast.error(`Idea generation failed: ${getApiErrorMessage(error)}`)
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

  const askForIdea = (question: string) => {
    return ideaMutation.mutateAsync(question)
  }

  return {
    generateContinuation,
    generateContinuationAsync,
    regenerateLast,
    commitChunk,
    isGenerating: generateMutation.isPending || regenerateMutation.isPending,
    generationError: generateMutation.error || regenerateMutation.error,
    askForIdea,
    isThinkingIdea: ideaMutation.isPending,
    ideaError: ideaMutation.error,
  }
}
