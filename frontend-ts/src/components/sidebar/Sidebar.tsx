'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GenerationSettings } from './GenerationSettings'
import { ContextTabs } from './ContextTabs'
import { InspirationGallery } from './InspirationGallery'
import { ChevronDown } from 'lucide-react'

export function Sidebar() {
  const [openGen, setOpenGen] = useState(true)
  const [openCtx, setOpenCtx] = useState(true)
  const [openImgs, setOpenImgs] = useState(true)

  return (
    <div className="space-y-4 sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
      {/* Generation Settings (collapsible) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setOpenGen(v => !v)}
            aria-expanded={openGen}
          >
            <CardTitle className="text-lg">Generation Settings</CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${openGen ? '' : '-rotate-90'}`} />
          </button>
        </CardHeader>
        {openGen && (
          <CardContent>
            <GenerationSettings />
          </CardContent>
        )}
      </Card>

      {/* Context (collapsible) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setOpenCtx(v => !v)}
            aria-expanded={openCtx}
          >
            <CardTitle className="text-lg">Context</CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${openCtx ? '' : '-rotate-90'}`} />
          </button>
        </CardHeader>
        {openCtx && (
          <CardContent>
            <ContextTabs />
          </CardContent>
        )}
      </Card>

      {/* Inspiration Images (collapsible) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setOpenImgs(v => !v)}
            aria-expanded={openImgs}
          >
            <CardTitle className="text-lg">Inspiration Images</CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${openImgs ? '' : '-rotate-90'}`} />
          </button>
        </CardHeader>
        {openImgs && (
          <CardContent>
            <InspirationGallery />
          </CardContent>
        )}
      </Card>
    </div>
  )
}
