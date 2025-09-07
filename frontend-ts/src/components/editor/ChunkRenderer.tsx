'use client'

import { Settings, Trash2, GitBranch, Split, Merge, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAppStore } from '@/stores/appStore'
import { toast } from 'sonner'
import { uid } from '@/lib/utils'
import type { Chunk } from '@/lib/types'
import { deleteSnippet as apiDeleteSnippet, updateSnippet as apiUpdateSnippet } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

interface ChunkRendererProps {
  chunk: Chunk
  index: number
}

export function ChunkRenderer({ chunk, index }: ChunkRendererProps) {
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
      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory] })
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
      queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory] })
      toast.success('Chunk deleted')
    } catch (error) {
      console.error('Failed to delete chunk:', error)
      setChunks(before) // rollback
      toast.error(`Failed to delete chunk: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleBranchFrom = () => {
    const chunkIndex = chunks.findIndex(c => c.id === chunk.id)
    const before = [...chunks]
    const after = before.slice(0, chunkIndex + 1)
    pushHistory("branch", before, after)
    setChunks(after)
    toast.success("Branched from chunk - story trimmed to this point")
  }

  const handleSplitChunk = () => {
    if (!isEditing || !editingText) return
    
    // Get cursor position from the textarea
    const textarea = document.activeElement as HTMLTextAreaElement
    const cursorPosition = textarea?.selectionStart || Math.floor(editingText.length / 2)
    
    const beforeText = editingText.substring(0, cursorPosition).trim()
    const afterText = editingText.substring(cursorPosition).trim()
    
    if (!beforeText || !afterText) {
      toast.error("Cannot split - both parts must have content")
      return
    }
    
    const chunkIndex = chunks.findIndex(c => c.id === chunk.id)
    const before = [...chunks]
    
    // Create new chunk for the second part
    const newChunk: Chunk = {
      id: uid(),
      text: afterText,
      author: chunk.author,
      timestamp: Date.now(),
    }
    
    // Update current chunk with first part and insert new chunk after
    const updatedChunks = [...chunks]
    updatedChunks[chunkIndex] = { ...chunk, text: beforeText, timestamp: Date.now() }
    updatedChunks.splice(chunkIndex + 1, 0, newChunk)
    
    pushHistory("edit", before, updatedChunks)
    setChunks(updatedChunks)
    setEditingId(null)
    setEditingText("")
    
    toast.success("Chunk split successfully")
  }

  const handleMergeWithNext = () => {
    const chunkIndex = chunks.findIndex(c => c.id === chunk.id)
    if (chunkIndex >= chunks.length - 1) {
      toast.error("Cannot merge - no next chunk")
      return
    }
    
    const nextChunk = chunks[chunkIndex + 1]
    const mergedText = chunk.text + " " + nextChunk.text
    
    const before = [...chunks]
    const after = chunks.filter((_, i) => i !== chunkIndex + 1)
    after[chunkIndex] = {
      ...chunk,
      text: mergedText,
      timestamp: Date.now(),
    }
    
    pushHistory("edit", before, after)
    setChunks(after)
    
    toast.success("Merged with next chunk")
  }

  const handleMergeWithPrevious = () => {
    const chunkIndex = chunks.findIndex(c => c.id === chunk.id)
    if (chunkIndex <= 0) {
      toast.error("Cannot merge - no previous chunk")
      return
    }
    
    const previousChunk = chunks[chunkIndex - 1]
    const mergedText = previousChunk.text + " " + chunk.text
    
    const before = [...chunks]
    const after = chunks.filter((_, i) => i !== chunkIndex)
    after[chunkIndex - 1] = {
      ...previousChunk,
      text: mergedText,
      timestamp: Date.now(),
    }
    
    pushHistory("edit", before, after)
    setChunks(after)
    
    toast.success("Merged with previous chunk")
  }

  const handleMoveUp = () => {
    const chunkIndex = chunks.findIndex(c => c.id === chunk.id)
    if (chunkIndex <= 0) {
      toast.error("Cannot move up - already at top")
      return
    }
    
    const before = [...chunks]
    const after = [...chunks]
    
    // Swap with previous chunk
    const temp = after[chunkIndex]
    after[chunkIndex] = after[chunkIndex - 1]
    after[chunkIndex - 1] = temp
    
    pushHistory("edit", before, after)
    setChunks(after)
    
    toast.success("Moved chunk up")
  }

  const handleMoveDown = () => {
    const chunkIndex = chunks.findIndex(c => c.id === chunk.id)
    if (chunkIndex >= chunks.length - 1) {
      toast.error("Cannot move down - already at bottom")
      return
    }
    
    const before = [...chunks]
    const after = [...chunks]
    
    // Swap with next chunk
    const temp = after[chunkIndex]
    after[chunkIndex] = after[chunkIndex + 1]
    after[chunkIndex + 1] = temp
    
    pushHistory("edit", before, after)
    setChunks(after)
    
    toast.success("Moved chunk down")
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
                if (e.shiftKey) {
                  // Ctrl+Shift+Enter = Split chunk
                  e.preventDefault()
                  handleSplitChunk()
                } else {
                  // Ctrl+Enter = Save edit
                  e.preventDefault()
                  saveEdit()
                }
              }
              if (e.key === "Escape") {
                e.preventDefault()
                cancelEdit()
              }
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit}>Save</Button>
            <Button size="sm" variant="outline" onClick={handleSplitChunk} title="Split at cursor (Ctrl+Shift+Enter)">
              <Split className="h-3 w-3 mr-1" />
              Split
            </Button>
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
                    onClick={handleMergeWithPrevious}
                    disabled={index === 0}
                  >
                    <Merge className="h-4 w-4 mr-2" /> Merge with previous
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm" 
                    onClick={handleMergeWithNext}
                    disabled={index >= chunks.length - 1}
                  >
                    <Merge className="h-4 w-4 mr-2" /> Merge with next
                  </Button>
                  
                  <div className="border-t border-gray-100 my-1"></div>
                  
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm" 
                    onClick={handleMoveUp}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4 mr-2" /> Move up
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm" 
                    onClick={handleMoveDown}
                    disabled={index >= chunks.length - 1}
                  >
                    <ArrowDown className="h-4 w-4 mr-2" /> Move down
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
