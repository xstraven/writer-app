'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBranchPath, getLorebook, loadAppState, getStorySettings } from '@/lib/api'
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
    setGallery,
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

  // Query to load per-story settings (preferred)
  const { data: storySettings, isLoading: storySettingsLoading, error: storySettingsError } = useQuery({
    queryKey: ['story-settings', currentStory],
    queryFn: () => getStorySettings(currentStory),
    enabled: !!currentStory,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  })

  // Legacy global app state (fallback)
  const { data: appStateData, isLoading: appStateLoading, error: appStateError } = useQuery({
    queryKey: ['app-state-legacy'],
    queryFn: () => loadAppState(),
    enabled: !currentStory, // disabled when story available; only used as deep fallback in effects
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  })

  // Sync backend chunks when branch data changes
  useEffect(() => {
    if (!branchData) return
    const path = branchData.path || []
    const backendChunks = path.map(snippetToChunk)

    if (backendChunks.length === 0) {
      // Do not clobber local draft when backend is empty
      return
    }

    // If frontend has no chunks, adopt backend entirely
    if (chunks.length === 0 && backendChunks.length > 0) {
      setChunks(backendChunks)
      return
    }

    // If backend has extended content beyond local and shares the same prefix, adopt backend
    const minLen = Math.min(chunks.length, backendChunks.length)
    const prefixesMatch = Array.from({ length: minLen }).every((_, i) => (
      chunks[i]?.id === backendChunks[i]?.id && chunks[i]?.text === backendChunks[i]?.text
    ))

    if (prefixesMatch && backendChunks.length > chunks.length) {
      console.log('Backend has additional chunks; extending local copy')
      setChunks(backendChunks)
      return
    }

    // Otherwise, leave local state as-is to preserve uncommitted local chunks
  }, [branchData, setChunks, chunks])

  // Sync lorebook when data changes
  useEffect(() => {
    if (lorebookData && Array.isArray(lorebookData)) {
      console.log('Syncing lorebook from backend:', lorebookData.length, 'entries')
      setLorebook(lorebookData)
    }
  }, [lorebookData, setLorebook])

  // Apply per-story settings when available
  useEffect(() => {
    if (storySettings) {
      const s = storySettings
      if (s.context) setContext(s.context)
      if (typeof s.synopsis === 'string') setSynopsis(s.synopsis)
      if (s.memory) setMemory(s.memory)
      const settingsToUpdate: any = {}
      if (s.temperature !== undefined) settingsToUpdate.temperature = s.temperature
      if (s.max_tokens !== undefined) settingsToUpdate.max_tokens = s.max_tokens
      if (s.model !== undefined) settingsToUpdate.model = s.model || undefined
      if (s.system_prompt !== undefined) settingsToUpdate.system_prompt = s.system_prompt || undefined
      if (s.max_context_window !== undefined) settingsToUpdate.max_context_window = s.max_context_window
      if (Object.keys(settingsToUpdate).length > 0) updateGenerationSettings(settingsToUpdate)
      // Gallery (UI-only, local state)
      if (Array.isArray(s.gallery)) setGallery(s.gallery)
      // Lorebook (if provided)
      if (Array.isArray((s as any).lorebook)) setLorebook((s as any).lorebook)
    } else if (!storySettings && appStateData) {
      // Legacy fallback path
      if (appStateData.context) setContext(appStateData.context)
      const settingsToUpdate: any = {}
      if (appStateData.temperature !== undefined) settingsToUpdate.temperature = appStateData.temperature
      if (appStateData.max_tokens !== undefined) settingsToUpdate.max_tokens = appStateData.max_tokens
      if (appStateData.model) settingsToUpdate.model = appStateData.model
      if (appStateData.system_prompt) settingsToUpdate.system_prompt = appStateData.system_prompt
      if (Object.keys(settingsToUpdate).length > 0) updateGenerationSettings(settingsToUpdate)
    }
  }, [storySettings, appStateData, setContext, updateGenerationSettings])

  // Auto-sync when story changes
  useEffect(() => {
    if (currentStory) {
      refetchBranch()
    }
  }, [currentStory, refetchBranch])

  const isLoading = branchLoading || lorebookLoading || storySettingsLoading
  const error = branchError || lorebookError || storySettingsError

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
