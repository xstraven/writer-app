'use client'

import { useState } from 'react'
import { 
  BookText, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Tag, 
  Key,
  ToggleLeft,
  ToggleRight,
  Search
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/stores/appStore'
import { createLoreEntry, updateLoreEntry, deleteLoreEntry, saveStorySettings } from '@/lib/api'
import { toast } from 'sonner'
import { uid } from '@/lib/utils'
import type { LoreEntry, LoreEntryCreate, LoreEntryUpdate } from '@/lib/types'

interface EditingEntry extends Partial<LoreEntry> {
  isNew?: boolean
}

export function LorebookPanel() {
  const { lorebook, setLorebook, currentStory } = useAppStore()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Filter lorebook based on search
  const filteredLorebook = lorebook.filter(entry =>
    entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.kind.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
    entry.keys.some(key => key.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const startEditing = (entry: LoreEntry) => {
    setEditingEntry({
      ...entry,
      tags: [...entry.tags],
      keys: [...entry.keys],
    })
  }

  const startCreating = () => {
    setEditingEntry({
      isNew: true,
      id: uid(),
      story: currentStory,
      name: '',
      kind: 'character',
      summary: '',
      tags: [],
      keys: [],
      always_on: false,
    })
  }

  const cancelEditing = () => {
    setEditingEntry(null)
  }

  const saveEntry = async () => {
    if (!editingEntry) return

    if (!editingEntry.name?.trim() || !editingEntry.summary?.trim()) {
      toast.error("Name and summary are required")
      return
    }

    setIsLoading(true)
    try {
      if (editingEntry.isNew) {
        // Create new entry
        const newEntryData: LoreEntryCreate = {
          story: currentStory,
          name: editingEntry.name.trim(),
          kind: editingEntry.kind || 'character',
          summary: editingEntry.summary.trim(),
          tags: editingEntry.tags || [],
          keys: editingEntry.keys || [],
          always_on: editingEntry.always_on || false,
        }
        
        const createdEntry = await createLoreEntry(newEntryData)
        const updatedLore = [...lorebook, createdEntry]
        setLorebook(updatedLore)
        // Persist full lorebook snapshot per-story (best-effort)
        try { await saveStorySettings({ story: currentStory, lorebook: updatedLore }) } catch {}
        toast.success("Lore entry created")
      } else {
        // Update existing entry
        const updateData: LoreEntryUpdate = {
          name: editingEntry.name.trim(),
          kind: editingEntry.kind,
          summary: editingEntry.summary.trim(),
          tags: editingEntry.tags,
          keys: editingEntry.keys,
          always_on: editingEntry.always_on,
        }
        
        const updatedEntry = await updateLoreEntry(editingEntry.id!, updateData)
        const updatedLore = lorebook.map(entry => 
          entry.id === editingEntry.id ? updatedEntry : entry
        )
        setLorebook(updatedLore)
        try { await saveStorySettings({ story: currentStory, lorebook: updatedLore }) } catch {}
        toast.success("Lore entry updated")
      }
      
      setEditingEntry(null)
    } catch (error) {
      console.error('Failed to save lore entry:', error)
      toast.error(`Failed to save entry: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteEntry = async (entryId: string) => {
    if (!confirm('Delete this lore entry? This cannot be undone.')) {
      return
    }

    setIsLoading(true)
    try {
      await deleteLoreEntry(entryId)
      const updatedLore = lorebook.filter(entry => entry.id !== entryId)
      setLorebook(updatedLore)
      try { await saveStorySettings({ story: currentStory, lorebook: updatedLore }) } catch {}
      toast.success("Lore entry deleted")
    } catch (error) {
      console.error('Failed to delete lore entry:', error)
      toast.error(`Failed to delete entry: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const updateEditingField = (field: keyof EditingEntry, value: any) => {
    if (editingEntry) {
      setEditingEntry({ ...editingEntry, [field]: value })
    }
  }

  const addTag = (tag: string) => {
    if (editingEntry && tag.trim() && !editingEntry.tags?.includes(tag.trim())) {
      updateEditingField('tags', [...(editingEntry.tags || []), tag.trim()])
    }
  }

  const removeTag = (tagIndex: number) => {
    if (editingEntry) {
      updateEditingField('tags', editingEntry.tags?.filter((_, index) => index !== tagIndex) || [])
    }
  }

  const addKey = (key: string) => {
    if (editingEntry && key.trim() && !editingEntry.keys?.includes(key.trim())) {
      updateEditingField('keys', [...(editingEntry.keys || []), key.trim()])
    }
  }

  const removeKey = (keyIndex: number) => {
    if (editingEntry) {
      updateEditingField('keys', editingEntry.keys?.filter((_, index) => index !== keyIndex) || [])
    }
  }

  const renderEditForm = () => {
    if (!editingEntry) return null

    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{editingEntry.isNew ? 'Create Lore Entry' : 'Edit Lore Entry'}</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={saveEntry}
                disabled={isLoading || !editingEntry.name?.trim() || !editingEntry.summary?.trim()}
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEditing}
                disabled={isLoading}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Name and Kind */}
          <div className="flex gap-2">
            <Input
              value={editingEntry.name || ''}
              onChange={(e) => updateEditingField('name', e.target.value)}
              placeholder="Entry name"
              className="flex-1"
            />
            <Input
              value={editingEntry.kind || ''}
              onChange={(e) => updateEditingField('kind', e.target.value)}
              placeholder="Kind (character, place, etc.)"
              className="w-32"
            />
          </div>

          {/* Summary */}
          <Textarea
            value={editingEntry.summary || ''}
            onChange={(e) => updateEditingField('summary', e.target.value)}
            placeholder="Description of this lore entry"
            className="min-h-[60px]"
          />

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Tags
            </label>
            <div className="flex flex-wrap gap-1 min-h-[24px] p-2 border rounded">
              {editingEntry.tags?.map((tag, index) => (
                <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {tag}
                  <button
                    onClick={() => removeTag(index)}
                    className="hover:text-blue-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <Input
              placeholder="Add tag (press Enter)"
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  addTag(e.currentTarget.value.trim())
                  e.currentTarget.value = ''
                }
              }}
            />
          </div>

          {/* Keys */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <Key className="h-3 w-3" />
              Trigger Keys
            </label>
            <div className="flex flex-wrap gap-1 min-h-[24px] p-2 border rounded">
              {editingEntry.keys?.map((key, index) => (
                <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                  {key}
                  <button
                    onClick={() => removeKey(index)}
                    className="hover:text-green-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <Input
              placeholder="Add trigger key (press Enter)"
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  addKey(e.currentTarget.value.trim())
                  e.currentTarget.value = ''
                }
              }}
            />
          </div>

          {/* Always On Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">
              Always include in context
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateEditingField('always_on', !editingEntry.always_on)}
              className="h-6 p-1"
            >
              {editingEntry.always_on ? (
                <ToggleRight className="h-4 w-4 text-green-600" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-gray-400" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with Search and Add Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-3 w-3 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search lorebook..."
            className="text-sm pl-7"
          />
        </div>
        <Button
          size="sm"
          onClick={startCreating}
          disabled={isLoading || !!editingEntry}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {/* Editing Form */}
      {editingEntry && renderEditForm()}

      {/* Lorebook Entries */}
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {filteredLorebook.map((entry) => (
            <Card key={entry.id} className="border shadow-none">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookText className="h-4 w-4" />
                    <span>{entry.name}</span>
                    <span className="text-xs text-gray-500">• {entry.kind}</span>
                    {entry.always_on && (
                      <span className="text-xs bg-green-100 text-green-800 px-1 rounded">
                        Always On
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing(entry)}
                      disabled={isLoading || !!editingEntry}
                      className="h-6 w-6 p-0"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteEntry(entry.id)}
                      disabled={isLoading || !!editingEntry}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  {entry.summary}
                </p>
                
                {/* Tags and Keys */}
                <div className="space-y-1">
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.map((tag, index) => (
                        <span key={index} className="text-xs bg-blue-100 text-blue-700 px-1 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {entry.keys.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.keys.map((key, index) => (
                        <span key={index} className="text-xs bg-green-100 text-green-700 px-1 rounded">
                          🔑 {key}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredLorebook.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-500">
              {searchTerm ? 'No entries match your search' : 'No lore entries yet'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
