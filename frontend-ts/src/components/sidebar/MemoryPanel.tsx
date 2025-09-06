'use client'

import { useState } from 'react'
import { Brain, Sparkles, Loader2, Plus, Pencil, Trash2, Save, X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/stores/appStore'
import { extractMemory } from '@/lib/api'
import { toast } from 'sonner'
import type { MemoryItem } from '@/lib/types'

export function MemoryPanel() {
  const { memory, setMemory, chunks, generationSettings } = useAppStore()
  const [isExtracting, setIsExtracting] = useState(false)
  // Add/edit state
  const [newChar, setNewChar] = useState({ label: '', detail: '' })
  const [newSubplot, setNewSubplot] = useState({ label: '', detail: '' })
  const [newFact, setNewFact] = useState({ label: '', detail: '' })
  const [editing, setEditing] = useState<null | { section: 'characters' | 'subplots' | 'facts'; index: number; label: string; detail: string }>(null)
  const [query, setQuery] = useState('')

  const handleExtractMemory = async () => {
    if (chunks.length === 0) {
      toast.error("No story content to extract memory from")
      return
    }

    setIsExtracting(true)
    try {
      const draftText = chunks.map(c => c.text).join('\n\n')
      const result = await extractMemory(draftText, generationSettings.model)
      setMemory(result)
      toast.success("Memory extracted from story")
    } catch (error) {
      console.error('Memory extraction failed:', error)
      toast.error(`Failed to extract memory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExtracting(false)
    }
  }

  const renderMemorySection = (title: string, items: MemoryItem[]) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-neutral-700">{title}</h4>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item, index) => {
            const isEditing = editing && editing.section === (title.toLowerCase() as any) && editing.index === index
            return (
              <li key={index} className="text-sm bg-neutral-50 rounded p-2 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={editing.label}
                        onChange={(e) => setEditing({ ...(editing as any), label: e.target.value })}
                        placeholder="Label"
                      />
                      <input
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={editing.detail}
                        onChange={(e) => setEditing({ ...(editing as any), detail: e.target.value })}
                        placeholder="Detail"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="font-medium truncate">{item.label}</div>
                      <div className="text-xs text-neutral-600 break-words">{item.detail}</div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button size="icon" variant="ghost" title="Save" onClick={() => {
                        if (!editing) return
                        const next = { ...memory }
                        const section = editing.section
                        const arr = [...(next as any)[section]] as MemoryItem[]
                        arr[editing.index] = { ...arr[editing.index], label: editing.label.trim(), detail: editing.detail.trim() }
                        ;(next as any)[section] = arr
                        setMemory(next)
                        setEditing(null)
                      }}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Cancel" onClick={() => setEditing(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditing({ section: title.toLowerCase() as any, index, label: item.label, detail: item.detail })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Delete" onClick={() => {
                        const next = { ...memory }
                        const section = title.toLowerCase() as 'characters' | 'subplots' | 'facts'
                        const arr = (next as any)[section] as MemoryItem[]
                        ;(next as any)[section] = arr.filter((_, i) => i !== index)
                        setMemory(next)
                      }}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 italic">None yet</p>
      )}
    </div>
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Memory
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleExtractMemory}
            disabled={isExtracting || chunks.length === 0}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            {isExtracting ? (
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
            onClick={() => {
              if (!confirm('Clear all memory items? This cannot be undone.')) return
              setMemory({ characters: [], subplots: [], facts: [] })
            }}
            size="sm"
            variant="ghost"
            className="text-neutral-500"
          >
            Clear
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-3 w-3 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search memory..."
              className="text-sm pl-7"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[360px]">
          <div className="space-y-6">
            {/* Characters */}
            {renderMemorySection("Characters", memory.characters.filter(it => !query.trim() || it.label.toLowerCase().includes(query.toLowerCase()) || it.detail.toLowerCase().includes(query.toLowerCase())))}
            <div className="grid grid-cols-2 gap-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="Name" value={newChar.label} onChange={(e) => setNewChar({ ...newChar, label: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Detail" value={newChar.detail} onChange={(e) => setNewChar({ ...newChar, detail: e.target.value })} />
              <Button size="sm" variant="outline" className="col-span-2" disabled={!newChar.label.trim() || !newChar.detail.trim()} onClick={() => {
                const next = { ...memory, characters: [...memory.characters, { type: 'character', label: newChar.label.trim(), detail: newChar.detail.trim() }] }
                setMemory(next)
                setNewChar({ label: '', detail: '' })
              }}>
                <Plus className="h-3 w-3 mr-1" /> Add Character
              </Button>
            </div>

            {/* Subplots */}
            {renderMemorySection("Subplots", memory.subplots.filter(it => !query.trim() || it.label.toLowerCase().includes(query.toLowerCase()) || it.detail.toLowerCase().includes(query.toLowerCase())))}
            <div className="grid grid-cols-2 gap-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="Label" value={newSubplot.label} onChange={(e) => setNewSubplot({ ...newSubplot, label: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Detail" value={newSubplot.detail} onChange={(e) => setNewSubplot({ ...newSubplot, detail: e.target.value })} />
              <Button size="sm" variant="outline" className="col-span-2" disabled={!newSubplot.label.trim() || !newSubplot.detail.trim()} onClick={() => {
                const next = { ...memory, subplots: [...memory.subplots, { type: 'subplot', label: newSubplot.label.trim(), detail: newSubplot.detail.trim() }] }
                setMemory(next)
                setNewSubplot({ label: '', detail: '' })
              }}>
                <Plus className="h-3 w-3 mr-1" /> Add Subplot
              </Button>
            </div>

            {/* Facts */}
            {renderMemorySection("Facts", memory.facts.filter(it => !query.trim() || it.label.toLowerCase().includes(query.toLowerCase()) || it.detail.toLowerCase().includes(query.toLowerCase())))}
            <div className="grid grid-cols-2 gap-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="Label" value={newFact.label} onChange={(e) => setNewFact({ ...newFact, label: e.target.value })} />
              <input className="border rounded px-2 py-1 text-sm" placeholder="Detail" value={newFact.detail} onChange={(e) => setNewFact({ ...newFact, detail: e.target.value })} />
              <Button size="sm" variant="outline" className="col-span-2" disabled={!newFact.label.trim() || !newFact.detail.trim()} onClick={() => {
                const next = { ...memory, facts: [...memory.facts, { type: 'fact', label: newFact.label.trim(), detail: newFact.detail.trim() }] }
                setMemory(next)
                setNewFact({ label: '', detail: '' })
              }}>
                <Plus className="h-3 w-3 mr-1" /> Add Fact
              </Button>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
