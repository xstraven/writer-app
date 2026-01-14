'use client'

import { useEffect, useRef } from 'react'
import { saveStorySettings } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/stores/appStore'

// Save gallery to localStorage
const saveGalleryToLocalStorage = (story: string, gallery: any[]) => {
  try {
    const key = `gallery-${story}`
    localStorage.setItem(key, JSON.stringify(gallery))
    console.log('[Persistence] Saved gallery to localStorage, count:', gallery.length)
  } catch (e) {
    console.warn('Failed to save gallery to localStorage', e)
  }
}

// Load gallery from localStorage
export const loadGalleryFromLocalStorage = (story: string): any[] => {
  try {
    const key = `gallery-${story}`
    const saved = localStorage.getItem(key)
    if (saved) {
      const gallery = JSON.parse(saved)
      console.log('[Persistence] Loaded gallery from localStorage, count:', gallery.length)
      return gallery
    }
  } catch (e) {
    console.warn('Failed to load gallery from localStorage', e)
  }
  return []
}

// Debounced persistence of app-level settings (context, synopsis, gen settings).
export function usePersistAppState(delayMs: number = 600) {
  const {
    currentStory,
    generationSettings,
    context,
    gallery,
    synopsis,
    memory,
    generationSettingsHydrated,
    experimental,
  } = useAppStore()
  const queryClient = useQueryClient()
  const timer = useRef<NodeJS.Timeout | null>(null)
  const latest = useRef<{ story: string; payload: any }>({ story: '', payload: {} })

  // Save gallery to localStorage whenever it changes
  useEffect(() => {
    if (currentStory && gallery) {
      saveGalleryToLocalStorage(currentStory, gallery)
    }
  }, [currentStory, gallery])

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

    if (!generationSettingsHydrated) return

    if (timer.current) clearTimeout(timer.current)
    // Cache latest payload for potential flush (gallery excluded - now saved to localStorage)
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
        // gallery removed - now saved to localStorage instead
        synopsis,
        memory,
        experimental,
      },
    }

    timer.current = setTimeout(async () => {
      try {
        console.log('[Persistence] Saving story settings to backend')
        await saveStorySettings(latest.current.payload)
        queryClient.invalidateQueries({ queryKey: ['story-settings', currentStory] })
        console.log('[Persistence] Successfully saved story settings to backend')
      } catch (e) {
        console.warn('Failed to save app state', e)
      }
    }, delayMs)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [
    currentStory,
    generationSettings,
    context,
    // gallery removed - now saved separately to localStorage
    synopsis,
    memory,
    experimental,
    generationSettingsHydrated,
    delayMs,
    queryClient,
  ])

  // Best-effort flush on unload (no blocking call here; rely on debounce normally)
  useEffect(() => {
    const flush = () => {
      const payload = latest.current.payload
      const story = latest.current.story
      if (!story || !payload) return
      saveStorySettings(payload, { keepalive: true }).catch((err) => {
        console.warn('Failed to flush story settings before unload', err)
      })
    }
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [])
}
