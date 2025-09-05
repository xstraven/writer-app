'use client'

import { useState } from 'react'
import { Brain, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/stores/appStore'
import { extractMemory } from '@/lib/api'
import { toast } from 'sonner'
import type { MemoryItem } from '@/lib/types'

export function MemoryPanel() {
  const { memory, setMemory, chunks, generationSettings } = useAppStore()
  const [isExtracting, setIsExtracting] = useState(false)

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
          {items.map((item, index) => (
            <li key={index} className="text-sm bg-neutral-50 rounded p-2">
              <span className="font-medium">{item.label}:</span>{' '}
              <span className="text-neutral-600">{item.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-500 italic">None extracted yet</p>
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
        <Button 
          onClick={handleExtractMemory}
          disabled={isExtracting || chunks.length === 0}
          size="sm"
          variant="outline"
          className="w-full"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Extract from Story
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {renderMemorySection("Characters", memory.characters)}
            {renderMemorySection("Subplots", memory.subplots)}
            {renderMemorySection("Facts", memory.facts)}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}