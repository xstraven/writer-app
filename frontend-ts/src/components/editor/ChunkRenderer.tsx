'use client'

import { Settings, Trash2, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAppStore } from '@/stores/appStore'
import { toast } from 'sonner'
import type { Chunk } from '@/lib/types'
import { deleteSnippet as apiDeleteSnippet, updateSnippet as apiUpdateSnippet, createBranch, getBranches } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

interface ChunkRendererProps {
  chunk: Chunk
  index: number
}

export function ChunkRenderer({ chunk, index: _index }: ChunkRendererProps) {
  const queryClient = useQueryClient()
  const {
    hoveredId,
    setHoveredId,
    updateChunk,
    deleteChunk,
    setChunks,
    chunks,
    pushHistory,
    currentStory,
    currentBranch,
    setCurrentBranch,
    setBranches,
  } = useAppStore()

  const isHovered = hoveredId === chunk.id

  // Always-on editing for this chunk
  const [localText, setLocalText] = useState<string>(chunk.text)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef<string>(chunk.text)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setLocalText(chunk.text)
    lastSaved.current = chunk.text
    // Auto-resize on external updates
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
    })
  }, [chunk.id, chunk.text])

  const scheduleSave = (nextText: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        if (nextText === lastSaved.current) return
        const kind = chunk.author === 'user' ? 'user' : 'ai'
        const res = await apiUpdateSnippet(chunk.id, { content: nextText, kind })
        updateChunk(chunk.id, {
          text: res.content,
          timestamp: new Date(res.created_at).getTime(),
        })
        lastSaved.current = res.content
      } catch (error) {
        console.error('Failed to auto-save chunk:', error)
        toast.error(`Failed to save edit: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }, 500)
  }

  // Auto-resize on local edits
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [localText])

  // Keyboard navigation across chunk boundaries
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const pos = el.selectionStart ?? 0
    const atStart = pos === 0
    const atEnd = pos === el.value.length
    const focusChunk = (id: string | undefined, toEnd: boolean) => {
      if (!id) return
      const next = document.querySelector(`textarea[data-chunk="${id}"]`) as HTMLTextAreaElement | null
      if (next) {
        e.preventDefault()
        next.focus()
        const p = toEnd ? next.value.length : 0
        next.setSelectionRange(p, p)
      }
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && atStart) {
      const prevId = _index > 0 ? chunks[_index - 1]?.id : undefined
      focusChunk(prevId, true)
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && atEnd) {
      const nextId = _index < chunks.length - 1 ? chunks[_index + 1]?.id : undefined
      focusChunk(nextId, false)
    }
  }

  const handleDelete = async () => {
    // Optimistic: remove from UI immediately, rollback on failure
    const before = [...chunks]
    deleteChunk(chunk.id)
    try {
      await apiDeleteSnippet(chunk.id, currentStory)
      // Invalidate branch cache to let useStorySync refetch and reconcile
      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory, currentBranch] })
      toast.success('Chunk deleted')
    } catch (error) {
      console.error('Failed to delete chunk:', error)
      setChunks(before) // rollback
      toast.error(`Failed to delete chunk: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleBranchFrom = async () => {
    const name = window.prompt('Enter new branch name')?.trim()
    if (!name) {
      toast.error('Branch name is required')
      return
    }
    try {
      await createBranch(currentStory, name, chunk.id)
      setCurrentBranch(name)
      // Refresh branches list in store
      try {
        const list = await getBranches(currentStory)
        setBranches(list)
      } catch {}
      // Refresh to load the selected branch path
      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory, name] })
      toast.success(`Created branch "${name}"`)
    } catch (error) {
      console.error('Failed to create branch:', error)
      toast.error(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div
      onMouseEnter={() => setHoveredId(chunk.id)}
      onMouseLeave={() => setHoveredId(null)}
      className={cn(
        "relative group transition-colors px-0 py-0",
        isHovered ? "bg-amber-50" : "bg-transparent"
      )}
    >
      <Textarea
        ref={textareaRef}
        value={localText}
        onChange={(e) => {
          const v = e.target.value
          setLocalText(v)
          updateChunk(chunk.id, { text: v, timestamp: Date.now() })
          scheduleSave(v)
        }}
        onKeyDown={handleKeyDown}
        className="min-h-[48px] resize-none border-0 focus-visible:ring-0 focus-visible:outline-none bg-transparent px-0"
        style={{ overflow: 'hidden' }}
        data-chunk={chunk.id}
        placeholder="Write..."
      />

      {/* Hover menu */}
      {isHovered && (
        <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1 bg-white border shadow-sm rounded-full px-1 py-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="More">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1">
                <div className="space-y-1">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm" 
                    onClick={handleBranchFrom}
                  >
                    <GitBranch className="h-4 w-4 mr-2" /> Branch from here
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm text-red-600 hover:text-red-700 hover:bg-red-50" 
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete chunk
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  )
}
