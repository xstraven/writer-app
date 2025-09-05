'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { GenerationSettings } from './GenerationSettings'
import { ContextTabs } from './ContextTabs'
import { InspirationGallery } from './InspirationGallery'
import { ChevronDown } from 'lucide-react'
import { BranchesPanel } from './BranchesPanel'
import { useAppStore } from '@/stores/appStore'
import { getPromptPreview, deleteStory as apiDeleteStory, getStories } from '@/lib/api'
import { useState as useReactState } from 'react'
import { toast } from 'sonner'

export function Sidebar() {
  const [openGen, setOpenGen] = useState(true)
  const [openCtx, setOpenCtx] = useState(true)
  const [openImgs, setOpenImgs] = useState(true)
  const [openStory, setOpenStory] = useState(true)

  // Local modals/actions
  const [showBranches, setShowBranches] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptMessages, setPromptMessages] = useReactState<Array<{ role: string; content: string }>>([])
  const [loadingPrompt, setLoadingPrompt] = useState(false)

  const { currentStory, setCurrentStory } = useAppStore()

  return (
    <div className="space-y-4 sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
      {/* Story (collapsible) – moved to top */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setOpenStory(v => !v)}
            aria-expanded={openStory}
          >
            <CardTitle className="text-lg">Story</CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${openStory ? '' : '-rotate-90'}`} />
          </button>
        </CardHeader>
        {openStory && (
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowBranches(true)}>
                Branches
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
                Delete Story
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

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
            <div className="mt-3 flex justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setLoadingPrompt(true)
                  try {
                    const res = await getPromptPreview(currentStory, '', undefined)
                    setPromptMessages(res.messages || [])
                    setShowPrompt(true)
                  } finally {
                    setLoadingPrompt(false)
                  }
                }}
              >
                {loadingPrompt ? 'Loading…' : 'Preview Prompt'}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Scene (collapsible) */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setOpenCtx(v => !v)}
            aria-expanded={openCtx}
          >
            <CardTitle className="text-lg">Scene</CardTitle>
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

      

      {/* Branches Modal */}
      <Modal isOpen={showBranches} onClose={() => setShowBranches(false)} title="Story Branches" size="lg" position="right">
        <div className="p-4 h-full overflow-y-auto">
          <BranchesPanel />
        </div>
      </Modal>

      {/* Prompt Preview Modal */}
      <Modal isOpen={showPrompt} onClose={() => setShowPrompt(false)} title="Generation Prompt Preview" size="lg">
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-3">
            {promptMessages.map((message, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    {message.role.toUpperCase()}
                  </span>
                </div>
                <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed text-gray-700">
                  {message.content}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete Story" size="sm">
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700">This will delete all chunks, branches, lorebook entries, and settings for “{currentStory}”. This action cannot be undone.</p>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</Button>
            <Button onClick={async () => {
              setDeleting(true)
              try {
                await apiDeleteStory(currentStory)
                const updated = await getStories()
                const next = updated[0] || ''
                if (next) {
                  setCurrentStory(next)
                } else {
                  setCurrentStory('')
                }
                setShowDelete(false)
                toast.success('Story deleted')
              } catch (error) {
                console.error('Failed to delete story:', error)
                toast.error(`Failed to delete story: ${error instanceof Error ? error.message : 'Unknown error'}`)
              } finally {
                setDeleting(false)
              }
            }} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
