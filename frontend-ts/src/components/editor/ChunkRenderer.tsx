'use client'

import { Settings, Trash2, GitBranch, ArrowUpToLine, ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAppStore } from '@/stores/appStore'
import { toast } from 'sonner'
import type { Chunk } from '@/lib/types'
import { deleteSnippet as apiDeleteSnippet, createBranch, getBranches, insertSnippetAbove, insertSnippetBelow, getBranchPath } from '@/lib/api'
import { saveQueue } from '@/lib/saveQueue'
import { useQueryClient } from '@tanstack/react-query'
import { cn, uid } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

interface ChunkRendererProps {
  chunk: Chunk
  index: number
}

export function ChunkRenderer({ chunk, index }: ChunkRendererProps) {
  const queryClient = useQueryClient()
  const {
    hoveredId,
    setHoveredId,
    updateChunk,
    deleteChunk,
    setChunks,
    chunks,
    currentStory,
    currentBranch,
    setCurrentBranch,
    setBranches,
    pushHistory,
  } = useAppStore()

  const isHovered = hoveredId === chunk.id
  const [localText, setLocalText] = useState<string>(chunk.text)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setLocalText(chunk.text)
    // Auto-resize on external updates
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
    })
  }, [chunk.id, chunk.text])

  // No separate debounce here; saveQueue deduplicates with its own debounce.

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
      const prevId = index > 0 ? chunks[index - 1]?.id : undefined
      focusChunk(prevId, true)
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && atEnd) {
      const nextId = index < chunks.length - 1 ? chunks[index + 1]?.id : undefined
      focusChunk(nextId, false)
    }
  }

  const focusChunkById = (id: string) => {
    requestAnimationFrame(() => {
      const el = document.querySelector(`textarea[data-chunk="${id}"]`) as HTMLTextAreaElement | null
      if (el) {
        el.focus()
        el.setSelectionRange(0, 0)
      }
    })
  }

  const handleInsert = async (
    direction: 'above' | 'below',
  ) => {
    const state = useAppStore.getState()
    const currentChunks = state.chunks
    const targetIndex = currentChunks.findIndex(item => item.id === chunk.id)
    if (targetIndex === -1) {
      toast.error('Could not locate target chunk')
      return
    }

    const before = currentChunks.map(item => ({ ...item }))
    const optimisticId = uid()
    const newChunk: Chunk = {
      id: optimisticId,
      text: '',
      author: 'user',
      timestamp: Date.now(),
    }

    const insertIndex = direction === 'above' ? targetIndex : targetIndex + 1
    const optimisticChunks = [
      ...currentChunks.slice(0, insertIndex),
      newChunk,
      ...currentChunks.slice(insertIndex),
    ]
    setChunks(optimisticChunks)
    focusChunkById(optimisticId)

    try {
      const payload = {
        story: currentStory,
        content: '',
        kind: 'user' as const,
        set_active: true,
        branch: currentBranch,
      }
      const created = direction === 'above'
        ? await insertSnippetAbove({ ...payload, target_snippet_id: chunk.id })
        : await insertSnippetBelow({ ...payload, parent_snippet_id: chunk.id })

      let finalChunks = useAppStore.getState().chunks.map(item => ({ ...item }))
      try {
        const interimText = useAppStore.getState().chunks.find((c) => c.id === optimisticId)?.text ?? ''
        const branchResponse = currentBranch && currentBranch !== 'main'
          ? await getBranchPath(currentStory, { branch: currentBranch })
          : await getBranchPath(currentStory)
        const backendChunks: Chunk[] = (branchResponse.path || []).map((snippet) => ({
          id: snippet.id,
          text: snippet.content,
          author: snippet.kind === 'user' ? 'user' : 'llm',
          timestamp: new Date(snippet.created_at).getTime(),
        }))
        if (interimText && interimText.trim()) {
          const idx = backendChunks.findIndex((c) => c.id === created.id)
          if (idx !== -1 && backendChunks[idx].text.trim() === '') {
            backendChunks[idx] = { ...backendChunks[idx], text: interimText }
          }
        }
        setChunks(backendChunks)
        finalChunks = backendChunks.map(item => ({ ...item }))
      } catch (refreshError) {
        console.warn('Failed to refresh branch path after insert', refreshError)
        updateChunk(optimisticId, {
          id: created.id,
          text: created.content,
          timestamp: new Date(created.created_at).getTime(),
          author: created.kind === 'ai' ? 'llm' : 'user',
        })
        finalChunks = useAppStore.getState().chunks.map(item => ({ ...item }))
      }

      pushHistory('edit', before, finalChunks)

      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory, currentBranch] })
      toast.success(direction === 'above' ? 'Inserted chunk above' : 'Inserted chunk below')
      focusChunkById(created.id)
    } catch (error) {
      console.error('Failed to insert chunk:', error)
      setChunks(before)
      toast.error(`Failed to insert chunk: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleInsertAbove = () => handleInsert('above')
  const handleInsertBelow = () => handleInsert('below')

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
        "relative group transition-colors px-0 py-0 hover:bg-amber-50 dark:hover:bg-amber-900/40",
        isHovered ? "bg-amber-50 dark:bg-amber-900/40" : "bg-transparent"
      )}
    >
      <Textarea
        ref={textareaRef}
        value={localText}
        onChange={(e) => {
          const v = e.target.value
          setLocalText(v)
          updateChunk(chunk.id, { text: v, timestamp: Date.now() })
          const kind = chunk.author === 'user' ? 'user' : 'ai'
          saveQueue.queue(chunk.id, v, kind)
        }}
        onKeyDown={handleKeyDown}
        className="min-h-[48px] resize-none border-0 focus-visible:ring-0 focus-visible:outline-none bg-transparent px-0"
        style={{ overflow: 'hidden' }}
        data-chunk={chunk.id}
        placeholder="Write..."
      />

      {/* Hover menu always rendered; visibility via CSS */}
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
                  onClick={handleInsertAbove}
                >
                  <ArrowUpToLine className="h-4 w-4 mr-2" /> Insert above
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm" 
                  onClick={handleInsertBelow}
                >
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Insert below
                </Button>
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
    </div>
  )
}
