'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/appStore'
import { saveQueue } from '@/lib/saveQueue'

export function SaveLifecycle() {
  const queryClient = useQueryClient()
  const { currentStory, currentBranch } = useAppStore()
  const prevStory = useRef<string | null>(null)
  const prevBranch = useRef<string | null>(null)

  // Flush pending edits on tab hide/unload
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void saveQueue.flush({ keepalive: true })
      }
    }
    const onPageHide = () => {
      void saveQueue.flush({ keepalive: true })
    }
    const onBeforeUnload = () => {
      void saveQueue.flush({ keepalive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  // Invalidate caches when switching story/branch so we never see stale chunks
  useEffect(() => {
    const ps = prevStory.current
    const pb = prevBranch.current
    const storyChanged = ps && currentStory && ps !== currentStory
    const branchChanged = pb && currentBranch && pb !== currentBranch
    if (storyChanged || branchChanged) {
      // Previous selections: drop caches to avoid stale data flashing back
      if (ps) {
        queryClient.removeQueries({ queryKey: ['lorebook', ps] })
        queryClient.removeQueries({ queryKey: ['story-settings', ps] })
      }
      if (ps && pb) {
        queryClient.removeQueries({ queryKey: ['story-branch', ps, pb] })
      }
      // New selections: ensure a refetch occurs immediately
      if (currentStory) {
        queryClient.invalidateQueries({ queryKey: ['lorebook', currentStory] })
        queryClient.invalidateQueries({ queryKey: ['story-settings', currentStory] })
      }
      if (currentStory && currentBranch) {
        queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory, currentBranch] })
      }
    }
    prevStory.current = currentStory
    prevBranch.current = currentBranch
  }, [currentStory, currentBranch, queryClient])

  return null
}
