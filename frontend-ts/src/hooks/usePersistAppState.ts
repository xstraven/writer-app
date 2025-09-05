'use client'

import { useEffect, useRef } from 'react'
import { saveStorySettings } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'

// Debounced persistence of app-level settings (context, synopsis, gen settings).
export function usePersistAppState(delayMs: number = 600) {
  const { currentStory, generationSettings, context, gallery, synopsis, memory } = useAppStore()
  const timer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!currentStory) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await saveStorySettings({
          story: currentStory,
          temperature: generationSettings.temperature,
          max_tokens: generationSettings.max_tokens,
          model: generationSettings.model ?? null,
          system_prompt: generationSettings.system_prompt ?? null,
          max_context_window: generationSettings.max_context_window,
          context,
          gallery,
          synopsis,
          memory,
        })
        // Optional: add a subtle console log for debugging
        // console.log('App state saved')
      } catch (e) {
        // Swallow errors to avoid noisy UI; backend may be offline in dev
        console.warn('Failed to save app state', e)
      }
    }, delayMs)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [currentStory, generationSettings, context, gallery, synopsis, memory, delayMs])
}
