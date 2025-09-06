'use client'

import { useState } from 'react'
import { MapPin, Users, Package, Plus, X, Sparkles, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/stores/appStore'
import { suggestContext } from '@/lib/api'
import { toast } from 'sonner'
import type { ContextItem } from '@/lib/types'

export function ContextPanel() {
  const { context, setContext, chunks, generationSettings } = useAppStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newType, setNewType] = useState<'npc' | 'object'>('npc')
  const [newLabel, setNewLabel] = useState('')
  const [newDetail, setNewDetail] = useState('')
  
  // Form states for adding new items
  const [newNpcName, setNewNpcName] = useState('')
  const [newNpcDetail, setNewNpcDetail] = useState('')
  const [newObjectName, setNewObjectName] = useState('')
  const [newObjectDetail, setNewObjectDetail] = useState('')

  const updateSummary = (summary: string) => {
    setContext({ ...context, summary })
  }

  const addNpc = () => {
    if (!newNpcName.trim() || !newNpcDetail.trim()) {
      toast.error("Please fill in both name and detail")
      return
    }
    
    const newNpc: ContextItem = {
      label: newNpcName.trim(),
      detail: newNpcDetail.trim(),
    }
    
    setContext({
      ...context,
      npcs: [...context.npcs, newNpc]
    })
    
    setNewNpcName('')
    setNewNpcDetail('')
    toast.success("NPC added")
  }

  const removeNpc = (index: number) => {
    setContext({
      ...context,
      npcs: context.npcs.filter((_, i) => i !== index)
    })
    toast.success("NPC removed")
  }

  const addObject = () => {
    if (!newObjectName.trim() || !newObjectDetail.trim()) {
      toast.error("Please fill in both name and detail")
      return
    }
    
    const newObject: ContextItem = {
      label: newObjectName.trim(),
      detail: newObjectDetail.trim(),
    }
    
    setContext({
      ...context,
      objects: [...context.objects, newObject]
    })
    
    setNewObjectName('')
    setNewObjectDetail('')
    toast.success("Object added")
  }

  const removeObject = (index: number) => {
    setContext({
      ...context,
      objects: context.objects.filter((_, i) => i !== index)
    })
    toast.success("Object removed")
  }

  const handleAutoGenerate = async () => {
    if (chunks.length === 0) {
      toast.error("No story content to generate context from")
      return
    }

    setIsGenerating(true)
    try {
      const draftText = chunks.map(c => c.text).join('\n\n')
      const result = await suggestContext(draftText, generationSettings.model)
      setContext(result)
      toast.success("Context auto-generated from story")
    } catch (error) {
      console.error('Context generation failed:', error)
      toast.error(`Failed to generate context: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const clearContext = () => {
    if (!confirm('Clear the entire scene context? This cannot be undone.')) return
    setContext({ summary: "", npcs: [], objects: [] })
    toast.success("Context cleared")
  }

  const renderContextItems = (
    items: ContextItem[],
    onRemove: (index: number) => void,
    emptyMessage: string
  ) => (
    <div className="space-y-2">
      {items.length > 0 ? (
        items.map((item, index) => (
          <div key={index} className="flex items-start gap-2 p-2 bg-neutral-50 rounded">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{item.label}</div>
              <div className="text-xs text-neutral-600">{item.detail}</div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(index)}
              className="h-6 w-6 p-0 text-neutral-400 hover:text-red-500"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))
      ) : (
        <p className="text-sm text-neutral-500 italic text-center py-2">
          {emptyMessage}
        </p>
      )}
    </div>
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Scene
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowNew(v => !v)}
            size="sm"
            disabled={isGenerating}
          >
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
          <Button 
            onClick={handleAutoGenerate}
            disabled={isGenerating || chunks.length === 0}
            size="sm"
            variant="outline"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
          <Button
            onClick={clearContext}
            size="sm"
            variant="ghost"
            className="text-neutral-500"
          >
            Clear
          </Button>
          <div className="relative ml-auto w-56">
            <Search className="absolute left-2 top-2.5 h-3 w-3 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="text-sm pl-7"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {showNew && (
              <div className="p-3 border rounded bg-neutral-50 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-600">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType((e.target.value as 'npc' | 'object'))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="npc">NPC</option>
                    <option value="object">Object</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Name" className="text-sm" />
                  <Input value={newDetail} onChange={(e) => setNewDetail(e.target.value)} placeholder="Detail" className="text-sm" />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setShowNew(false); setNewLabel(''); setNewDetail('') }}>Cancel</Button>
                  <Button size="sm" disabled={!newLabel.trim() || !newDetail.trim()} onClick={() => {
                    if (newType === 'npc') {
                      const newNpc: ContextItem = { label: newLabel.trim(), detail: newDetail.trim() }
                      setContext({ ...context, npcs: [...context.npcs, newNpc] })
                    } else {
                      const newObj: ContextItem = { label: newLabel.trim(), detail: newDetail.trim() }
                      setContext({ ...context, objects: [...context.objects, newObj] })
                    }
                    setNewLabel(''); setNewDetail(''); setShowNew(false)
                  }}>Add</Button>
                </div>
              </div>
            )}
            {/* Scene Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700">Scene Summary</h4>
              <Textarea
                value={context.summary}
                onChange={(e) => updateSummary(e.target.value)}
                placeholder="Short summary of the current scene..."
                className="min-h-[60px] text-sm"
              />
            </div>

            {/* NPCs */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700 flex items-center gap-1">
                <Users className="h-3 w-3" />
                NPCs
              </h4>
              
              {renderContextItems(
                context.npcs.filter(it => !query.trim() || it.label.toLowerCase().includes(query.toLowerCase()) || it.detail.toLowerCase().includes(query.toLowerCase())),
                removeNpc,
                "No NPCs added yet"
              )}
              
              {/* New item form moved to header Add+ */}
            </div>

            {/* Objects */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700 flex items-center gap-1">
                <Package className="h-3 w-3" />
                Objects
              </h4>
              
              {renderContextItems(
                context.objects.filter(it => !query.trim() || it.label.toLowerCase().includes(query.toLowerCase()) || it.detail.toLowerCase().includes(query.toLowerCase())),
                removeObject,
                "No objects added yet"
              )}
              
              {/* New item form moved to header Add+ */}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
