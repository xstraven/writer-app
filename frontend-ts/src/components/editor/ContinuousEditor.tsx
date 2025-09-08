'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { TipTapComposer } from './TipTapComposer'
import { useAppStore } from '@/stores/appStore'
import { updateSnippet as apiUpdateSnippet } from '@/lib/api'

// Simple continuous editor that treats the story as one body of text.
// Persistence strategy: when the number of paragraph blocks (split by blank lines)
// matches the number of chunks, save each chunk with its corresponding paragraph.
// If counts differ, keep edits locally and avoid saving automatically.

export function ContinuousEditor() {
  const { chunks, setChunks, updateChunk, currentStory } = useAppStore()
  const [text, setText] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedKey = useRef<string>('')

  const combined = useMemo(() => chunks.map(c => c.text).join('\n\n'), [chunks])

  // Keep editor text in sync with backend chunks
  useEffect(() => {
    setText(combined)
  }, [combined])

  // Debounced persistence when paragraph count equals chunk count
  const scheduleSave = (next: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const parts = next.split(/\n\n+/)
      if (parts.length !== chunks.length) {
        // Different structure; skip auto-save for safety
        return
      }
      // Build a key to avoid redundant saves
      const key = parts.join('\n\n')
      if (key === lastSavedKey.current) return
      lastSavedKey.current = key
      // Save sequentially; update local state optimistically
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]
        const ch = chunks[i]
        if (!ch) continue
        if (ch.text === p) continue
        updateChunk(ch.id, { text: p, timestamp: Date.now() })
        try {
          await apiUpdateSnippet(ch.id, { content: p, kind: ch.author === 'user' ? 'user' : 'ai' })
        } catch {
          // Leave local change; subsequent sync/refresh will reconcile
        }
      }
    }, 800)
  }

  return (
    <TipTapComposer
      value={text}
      onChange={(val) => {
        setText(val)
        scheduleSave(val)
      }}
      placeholder="Write your story..."
      className="min-h-[200px]"
    />
  )
}

