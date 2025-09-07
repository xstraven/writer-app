'use client'

import { useEffect, useRef } from 'react'
import { saveStorySettings } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/appStore'

// Debounced persistence of app-level settings (context, synopsis, gen settings).
export function usePersistAppState(delayMs: number = 600) {
  const { currentStory, generationSettings, context, gallery, synopsis, memory } = useAppStore()
  const queryClient = useQueryClient()
  const timer = useRef<NodeJS.Timeout | null>(null)
  const latest = useRef<{ story: string; payload: any }>({ story: '', payload: {} })

  useEffect(() => {
    if (!currentStory) return
    // If story is switching, flush previous payload immediately to avoid losing changes
    const prevStory = latest.current.story
    if (prevStory && prevStory !== currentStory && latest.current.payload) {
      // Best-effort fire-and-forget
      void saveStorySettings(latest.current.payload)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['story-settings', prevStory] })
        })
        .catch(() => {})
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }

    if (timer.current) clearTimeout(timer.current)
    // Cache latest payload for potential flush
    latest.current = {
      story: currentStory,
      payload: {
        story: currentStory,
        temperature: generationSettings.temperature,
        max_tokens: generationSettings.max_tokens,
        model: generationSettings.model ?? null,
        system_prompt: generationSettings.system_prompt ?? null,
        base_instruction: generationSettings.base_instruction ?? null,
        max_context_window: generationSettings.max_context_window,
        context,
        gallery,
        synopsis,
        memory,
      },
    }

    timer.current = setTimeout(async () => {
      try {
        await saveStorySettings(latest.current.payload)
        queryClient.invalidateQueries({ queryKey: ['story-settings', currentStory] })
      } catch (e) {
        console.warn('Failed to save app state', e)
      }
    }, delayMs)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [currentStory, generationSettings, context, gallery, synopsis, memory, delayMs])

  // Best-effort flush on unload (no blocking call here; rely on debounce normally)
  useEffect(() => {
    const handler = () => {
      // Intentionally no sync request; consider navigator.sendBeacon with a dedicated endpoint.
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])
}
