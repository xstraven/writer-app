'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, BookText, FileText, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/stores/appStore'
import { suggestContext } from '@/lib/api'
import { Sparkles, Loader2 } from 'lucide-react'
import { ContextPanel } from './ContextPanel'
import { LorebookPanel } from './LorebookPanel'
import { uid } from '@/lib/utils'

export function ContextTabs() {
  const { synopsis, setSynopsis, chunks, generationSettings } = useAppStore()
  const [isGenerating, setIsGenerating] = useState(false)
  // Synopsis search removed per request (keep UI minimal)
  const synopsisRef = useRef<HTMLTextAreaElement | null>(null)
  const resizeSynopsis = () => {
    const el = synopsisRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useEffect(() => { resizeSynopsis() }, [])
  useEffect(() => { resizeSynopsis() }, [synopsis])

  return (
    <Tabs defaultValue="synopsis" className="w-full">
      <TabsList className="grid grid-cols-3 w-full text-xs">
        <TabsTrigger value="synopsis" className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Synopsis
        </TabsTrigger>
        <TabsTrigger value="context" className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Scene
        </TabsTrigger>
        <TabsTrigger value="lorebook" className="flex items-center gap-1">
          <BookText className="h-3 w-3" />
          Lorebook
        </TabsTrigger>
      </TabsList>

      <TabsContent value="synopsis" className="mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (chunks.length === 0) return
              setIsGenerating(true)
              try {
                const draftText = chunks.map(c => c.text).join('\n\n')
                const ctx = await suggestContext(draftText, generationSettings.model)
                setSynopsis(ctx.summary || '')
              } finally {
                setIsGenerating(false)
              }
            }}
            disabled={isGenerating || chunks.length === 0}
            title={chunks.length === 0 ? 'Add some story text first' : 'Generate from Story'}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
          <Button size="sm" variant="ghost" className="text-neutral-500" onClick={() => {
            if (!confirm('Clear the synopsis? This cannot be undone.')) return
            setSynopsis('')
          }}>
            Clear
          </Button>
        </div>
        <Textarea
          ref={synopsisRef as any}
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          className="resize-none overflow-hidden h-auto"
          placeholder="Short summary of the story to guide the model…"
        />
      </TabsContent>

      <TabsContent value="context" className="mt-3">
        <ContextPanel />
      </TabsContent>

      <TabsContent value="lorebook" className="mt-3">
        <LorebookPanel />
      </TabsContent>
    </Tabs>
  )
}
