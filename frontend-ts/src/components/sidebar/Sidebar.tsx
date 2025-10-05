'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { GenerationSettings } from './GenerationSettings'
import { ContextTabs } from './ContextTabs'
import { InspirationGallery } from './InspirationGallery'
import { ChevronDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BranchesPanel } from './BranchesPanel'
import { useAppStore } from '@/stores/appStore'
import { getPromptPreview, deleteStory as apiDeleteStory, getStories, getBranches, truncateStory as apiTruncateStory } from '@/lib/api'
import { useState as useReactState } from 'react'
import { toast } from 'sonner'

export function Sidebar() {
  const [openGen, setOpenGen] = useState(true)
  const [openCtx, setOpenCtx] = useState(true)
  const [openImgs, setOpenImgs] = useState(true)
  const [openStory, setOpenStory] = useState(true)
  const [openExperimental, setOpenExperimental] = useState(false)

  // Local modals/actions
  const [showBranches, setShowBranches] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [showTruncate, setShowTruncate] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [truncating, setTruncating] = useState(false)
  const [dupName, setDupName] = useState('')
  const [dupMode, setDupMode] = useState<'main' | 'all'>('all')
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptMessages, setPromptMessages] = useReactState<Array<{ role: string; content: string }>>([])
  const [loadingPrompt, setLoadingPrompt] = useState(false)

  const {
    currentStory,
    setCurrentStory,
    currentBranch,
    setCurrentBranch,
    branches,
    setBranches,
    context,
    generationSettings,
    synopsis,
    lorebook,
    chunks,
    setChunks,
    clearHistory,
    setEditingId,
    setEditingText,
    experimental,
    updateExperimental,
  } = useAppStore()

  const queryClient = useQueryClient()

  // Load branches list for current story to populate selector
  const [loadingBranches, setLoadingBranches] = useState(false)
  const loadBranchesForStory = async (story: string) => {
    if (!story) return
    setLoadingBranches(true)
    try {
      const list = await getBranches(story)
      setBranches(list)
    } catch (e) {
      // non-fatal
    } finally {
      setLoadingBranches(false)
    }
  }

  // When story changes, fetch branches and reset to 'main' if not set
  useEffect(() => {
    loadBranchesForStory(currentStory)
    if (!currentBranch) setCurrentBranch('main')
  }, [currentStory])

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
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Branch:</span>
                <Select value={currentBranch || 'main'} onValueChange={(name) => setCurrentBranch(name)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">main</SelectItem>
                    {branches.filter(b => b.name !== 'main').map(b => (
                      <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowBranches(true)}>
                Branches
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowDuplicate(true)}>
                Duplicate Story
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowTruncate(true)}>
                Truncate Story
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
                    let draftText = chunks.map(c => c.text).join('\n\n')
                    const windowChars = Math.max(0, Math.floor((generationSettings.max_context_window ?? 0) * 3))
                    if (windowChars > 0 && draftText.length > windowChars) {
                      draftText = draftText.slice(-windowChars)
                    }
                    const effectiveContext = context
                      ? {
                          summary: (context.summary && context.summary.trim()) || synopsis,
                          npcs: [...context.npcs],
                          objects: [...context.objects],
                        }
                      : {
                          summary: synopsis,
                          npcs: [],
                          objects: [],
                        }

                    const res = await getPromptPreview({
                      story: currentStory,
                      instruction: '',
                      model: generationSettings.model,
                      system_prompt: generationSettings.system_prompt,
                      draft_text: draftText,
                      use_memory: true,
                      use_context: true,
                      context: effectiveContext,
                      lore_ids: lorebook.filter(l => l.always_on).map(l => l.id),
                    })
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

      {/* Experimental Features */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between"
            onClick={() => setOpenExperimental(v => !v)}
            aria-expanded={openExperimental}
          >
            <CardTitle className="text-lg">Experimental Features</CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${openExperimental ? '' : '-rotate-90'}`} />
          </button>
        </CardHeader>
        {openExperimental && (
          <CardContent>
            <div className="space-y-4">
              <label className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Internal editor workflow</span>
                    <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                      Beta
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 max-w-xs">
                    Generate four continuations and let an internal LLM judge pick the version that best follows your requested actions and story beats.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={!!experimental.internal_editor_workflow}
                  onChange={(event) => updateExperimental({ internal_editor_workflow: event.target.checked })}
                  aria-label="Toggle internal editor workflow"
                />
              </label>
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

      {/* Truncate Modal */}
      <Modal isOpen={showTruncate} onClose={() => setShowTruncate(false)} title="Truncate Story" size="sm">
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700">
            This removes all story chunks from “{currentStory}” but keeps the lorebook, synopsis, memory, and settings intact.
          </p>
          <p className="text-xs text-gray-500">
            A single empty chunk will remain so you can start rewriting without losing your supporting material.
          </p>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowTruncate(false)} disabled={truncating}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!currentStory) return
                setTruncating(true)
                try {
                  const response = await apiTruncateStory(currentStory)
                  const root = response?.root_snippet
                  if (root) {
                    setChunks([
                      {
                        id: root.id,
                        text: root.content ?? '',
                        author: root.kind === 'user' ? 'user' : 'llm',
                        timestamp: new Date(root.created_at).getTime(),
                      },
                    ])
                  } else {
                    setChunks([])
                  }
                  clearHistory()
                  setEditingId(null)
                  setEditingText('')
                  setCurrentBranch('main')
                  await loadBranchesForStory(currentStory)
                  queryClient.invalidateQueries({ queryKey: ['story-branch', currentStory], exact: false })
                  toast.success('Story truncated')
                  setShowTruncate(false)
                } catch (error: any) {
                  console.error('Failed to truncate story:', error)
                  toast.error(`Failed to truncate story: ${error?.message ?? 'Unknown error'}`)
                } finally {
                  setTruncating(false)
                }
              }}
              disabled={truncating}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {truncating ? 'Truncating…' : 'Truncate'}
            </Button>
          </div>
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

      {/* Duplicate Modal */}
      <Modal isOpen={showDuplicate} onClose={() => setShowDuplicate(false)} title="Duplicate Story" size="sm">
        <div className="p-4 space-y-3">
          <div>
            <label className="text-sm text-gray-700">New story name</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              value={dupName}
              onChange={(e) => setDupName(e.target.value)}
              placeholder={`Copy of ${currentStory}`}
            />
          </div>
          <div>
            <label className="text-sm text-gray-700">What to duplicate?</label>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="dup-mode" value="main" checked={dupMode==='main'} onChange={() => setDupMode('main')} />
                Main branch only
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="dup-mode" value="all" checked={dupMode==='all'} onChange={() => setDupMode('all')} />
                All branches
              </label>
            </div>
            <div className="text-xs text-neutral-500 mt-1">Lorebook and story settings (context, memory, synopsis, generation) are always duplicated.</div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowDuplicate(false)} disabled={duplicating}>Cancel</Button>
            <Button onClick={async () => {
              const target = (dupName || `Copy of ${currentStory}`).trim()
              if (!target) return
              setDuplicating(true)
              try {
                await (await import('@/lib/api')).duplicateStory(currentStory, target, dupMode)
                const updated = await (await import('@/lib/api')).getStories()
                if (!updated.includes(target)) updated.push(target)
                setCurrentStory(target)
                setCurrentBranch('main')
                setShowDuplicate(false)
                setDupName('')
                setDupMode('all')
                toast.success('Story duplicated')
              } catch (error) {
                console.error('Failed to duplicate story:', error)
                toast.error(`Failed to duplicate: ${error instanceof Error ? error.message : 'Unknown error'}`)
              } finally {
                setDuplicating(false)
              }
            }} disabled={duplicating}>
              {duplicating ? 'Duplicating…' : 'Duplicate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
