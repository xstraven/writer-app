'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBranchPath, getLorebook, loadAppState } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import { toast } from 'sonner'
import type { Chunk, Snippet } from '@/lib/types'

// Convert backend snippet to frontend chunk
const snippetToChunk = (snippet: Snippet): Chunk => ({
  id: snippet.id,
  text: snippet.content,
  author: snippet.kind === 'user' ? 'user' : 'llm',
  timestamp: new Date(snippet.created_at).getTime(),
})

export function useStorySync() {
  const { 
    currentStory, 
    setChunks, 
    chunks,
    setLorebook,
    setSynopsis,
    setContext,
    setMemory,
    updateGenerationSettings,
    context,
  } = useAppStore()

  // Query to load story branch from backend
  const { data: branchData, isLoading: branchLoading, error: branchError, refetch: refetchBranch } = useQuery({
    queryKey: ['story-branch', currentStory],
    queryFn: () => getBranchPath(currentStory),
    enabled: !!currentStory,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Query to load lorebook for current story
  const { data: lorebookData, isLoading: lorebookLoading, error: lorebookError } = useQuery({
    queryKey: ['lorebook', currentStory],
    queryFn: () => getLorebook(currentStory),
    enabled: !!currentStory,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Query to load app state (contains synopsis, context, memory)
  const { data: appStateData, isLoading: appStateLoading, error: appStateError } = useQuery({
    queryKey: ['app-state'],
    queryFn: () => loadAppState(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Sync backend chunks when branch data changes
  useEffect(() => {
    if (branchData?.path && branchData.path.length > 0) {
      // Convert snippets to chunks
      const backendChunks = branchData.path.map(snippetToChunk)
      
      // Only update if chunks are different (avoid infinite loops)
      const chunksAreDifferent = 
        backendChunks.length !== chunks.length ||
        backendChunks.some((chunk, index) => 
          chunks[index]?.id !== chunk.id || 
          chunks[index]?.text !== chunk.text
        )
      
      if (chunksAreDifferent) {
        console.log('Syncing chunks from backend:', backendChunks)
        setChunks(backendChunks)
      }
    } else if (branchData?.path && branchData.path.length === 0) {
      // Empty story - clear chunks
      if (chunks.length > 0) {
        console.log('Story is empty, clearing chunks')
        setChunks([])
      }
    }
  }, [branchData, setChunks, chunks])

  // Sync lorebook when data changes
  useEffect(() => {
    if (lorebookData && Array.isArray(lorebookData)) {
      console.log('Syncing lorebook from backend:', lorebookData.length, 'entries')
      setLorebook(lorebookData)
    }
  }, [lorebookData, setLorebook])

  // Sync app state (context, generation settings) when data changes
  useEffect(() => {
    if (appStateData) {
      console.log('Syncing app state from backend:', appStateData)
      
      // Update context if available
      if (appStateData.context) {
        setContext(appStateData.context)
      }
      
      // Update generation settings if available
      if (appStateData.temperature !== undefined || appStateData.max_tokens !== undefined) {
        const settingsToUpdate: any = {}
        if (appStateData.temperature !== undefined) settingsToUpdate.temperature = appStateData.temperature
        if (appStateData.max_tokens !== undefined) settingsToUpdate.max_tokens = appStateData.max_tokens
        if (appStateData.model) settingsToUpdate.model = appStateData.model
        if (appStateData.system_prompt) settingsToUpdate.system_prompt = appStateData.system_prompt
        
        updateGenerationSettings(settingsToUpdate)
        console.log('Updated generation settings from backend:', settingsToUpdate)
      }
    }
  }, [appStateData, setContext, updateGenerationSettings])

  // Auto-sync when story changes
  useEffect(() => {
    if (currentStory) {
      refetchBranch()
    }
  }, [currentStory, refetchBranch])

  const isLoading = branchLoading || lorebookLoading || appStateLoading
  const error = branchError || lorebookError || appStateError

  return {
    isLoading,
    error,
    refetch: () => {
      refetchBranch()
      // Lorebook and app state will refetch automatically when dependencies change
    },
    backendText: branchData?.text || '',
    snippets: branchData?.path || [],
    lorebookCount: lorebookData?.length || 0,
  }
}