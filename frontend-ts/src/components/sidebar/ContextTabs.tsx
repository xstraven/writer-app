'use client'

import { Plus, BookText, FileText, Brain, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/stores/appStore'
import { MemoryPanel } from './MemoryPanel'
import { ContextPanel } from './ContextPanel'
import { LorebookPanel } from './LorebookPanel'
import { uid } from '@/lib/utils'

export function ContextTabs() {
  const { synopsis, setSynopsis } = useAppStore()

  return (
    <Tabs defaultValue="synopsis" className="w-full">
      <TabsList className="grid grid-cols-4 w-full text-xs">
        <TabsTrigger value="synopsis" className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Synopsis
        </TabsTrigger>
        <TabsTrigger value="memory" className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          Memory
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
        <Textarea
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          className="min-h-[140px]"
          placeholder="Short summary of the story to guide the model…"
        />
      </TabsContent>

      <TabsContent value="memory" className="mt-3">
        <MemoryPanel />
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
