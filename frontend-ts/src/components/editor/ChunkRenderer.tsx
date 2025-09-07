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

interface ChunkRendererProps {
  chunk: Chunk
  index: number
}

export function ChunkRenderer({ chunk, index: _index }: ChunkRendererProps) {
  const queryClient = useQueryClient()
  const {
    editingId,
    editingText,
    hoveredId,
    setEditingId,
    setEditingText,
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

  const isEditing = editingId === chunk.id
  const isHovered = hoveredId === chunk.id

  const startEdit = () => {
    setEditingId(chunk.id)
    setEditingText(chunk.text)
  }

  const saveEdit = async () => {
    if (!editingId) return

    const before = [...chunks]
    const after = chunks.map(c =>
      c.id === editingId
        ? { ...c, text: editingText, timestamp: Date.now() }
        : c
    )
    // Optimistic update
    pushHistory("edit", before, after)
    setChunks(after)

    try {
      const kind = chunk.author === 'user' ? 'user' : 'ai'
      const res = await apiUpdateSnippet(editingId, { content: editingText, kind })
      // Ensure local matches server
      updateChunk(editingId, {
        text: res.content,
        timestamp: new Date(res.created_at).getTime(),
      })
      // Let subscribers refresh branch data
      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory, currentBranch] })
      toast.success('Chunk saved')
      setEditingId(null)
      setEditingText("")
    } catch (error) {
      console.error('Failed to save edit:', error)
      setChunks(before)
      toast.error(`Failed to save edit: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingText("")
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
      onDoubleClick={startEdit}
      onMouseEnter={() => setHoveredId(chunk.id)}
      onMouseLeave={() => setHoveredId(null)}
      className={cn(
        "relative group transition-colors px-0 py-0",
        isHovered ? "bg-amber-50" : "bg-transparent"
      )}
    >
      
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            autoFocus
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            className="min-h-[96px]"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                // Ctrl/Cmd+Enter = Save edit
                e.preventDefault()
                saveEdit()
              }
              if (e.key === "Escape") {
                e.preventDefault()
                cancelEdit()
              }
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit}>Save</Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="leading-relaxed whitespace-pre-wrap m-0">{chunk.text}</div>
      )}

      {/* Hover menu */}
      {isHovered && !isEditing && (
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
                    onClick={startEdit}
                  >
                    ✏️ Edit chunk
                  </Button>
                  
                  <div className="border-t border-gray-100 my-1"></div>
                  
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
