'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Menu,
  X,
  Upload,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
// import { GenerationSettings } from '@/components/sidebar/GenerationSettings'
import { useAppStore } from '@/stores/appStore'
import { getStories, healthCheck, llmHealthCheck, seedStoryAI, appendSnippet, generateFromProposals, importStory } from '@/lib/api'
import { toast } from 'sonner'
import type { ProposedLoreEntry } from '@/lib/types'

export function TopNavigation() {
  const { currentStory, setCurrentStory } = useAppStore()
  const [stories, setStories] = useState<string[]>([])
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [apiMessage, setApiMessage] = useState('')
  const [llmStatus, setLlmStatus] = useState<'checking' | 'ok' | 'error' | 'unknown'>('unknown')
  const [llmMessage, setLlmMessage] = useState('')

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const handleStoryChange = (story: string) => {
    setCurrentStory(story)
    setIsMobileMenuOpen(false)
  }
  
  // Modal: AI seed
  const [showSeedAI, setShowSeedAI] = useState(false)
  const [seedName, setSeedName] = useState('')
  const [seedPrompt, setSeedPrompt] = useState('')
  const [seeding, setSeeding] = useState(false)

  // Modal: Import story
  const [showImport, setShowImport] = useState(false)
  const [importName, setImportName] = useState('')
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)

  // Entity confirmation for lorebook
  const [proposedEntities, setProposedEntities] = useState<ProposedLoreEntry[]>([])
  const [selectedEntityNames, setSelectedEntityNames] = useState<Set<string>>(new Set())
  const [showEntityConfirmation, setShowEntityConfirmation] = useState(false)
  const [currentStoryContext, setCurrentStoryContext] = useState<{story: string, text: string} | null>(null)

  useEffect(() => {
    loadStories()
    checkApiStatus()
    // LLM status check is now manual (click the badge) to reduce log noise

    // Check API status every 30 seconds
    const interval = setInterval(() => {
      checkApiStatus()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Keep stories list fresh when current story changes (e.g., after deletion via sidebar)
  useEffect(() => {
    loadStories()
  }, [currentStory])

  const loadStories = async () => {
    try {
      const result = await getStories()
      setStories(result)
    } catch (error) {
      console.error('Failed to load stories:', error)
      toast.error('Failed to load stories')
    }
  }

  const checkApiStatus = async () => {
    try {
      await healthCheck()
      setApiStatus('ok')
      setApiMessage('API connection successful')
    } catch (error) {
      setApiStatus('error')
      setApiMessage(`API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const checkLlmStatus = async () => {
    try {
      await llmHealthCheck()
      setLlmStatus('ok')
      setLlmMessage('LLM connection successful')
    } catch (error) {
      setLlmStatus('error')
      setLlmMessage(`LLM connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleCreateStory = async () => {
    const storyName = prompt('Enter new story name:')
    if (!storyName || !storyName.trim()) return
    const newStoryName = storyName.trim()
    try {
      // Touch backend so the story appears in lists (create an empty root snippet)
      await appendSnippet({ story: newStoryName, content: '', kind: 'user', parent_id: null, set_active: true, branch: 'main' })
      await loadStories()
      setCurrentStory(newStoryName)
      toast.success(`Story "${newStoryName}" created`)
    } catch (error) {
      console.error('Failed to create story:', error)
      toast.error(`Failed to create story: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleOpenSeedAI = () => {
    setSeedName('')
    setSeedPrompt('')
    setShowSeedAI(true)
  }

  const handleSeedStory = async () => {
    const prompt = seedPrompt.trim()
    if (!prompt) {
      toast.error('Please enter a prompt')
      return
    }
    // Determine name
    const base = seedName.trim()
    const storyName = base || `Untitled ${stories.length + 1}`
    setSeeding(true)
    try {
      // Step 1: Generate opening scene + get entity proposals
      const result = await seedStoryAI({
        story: storyName,
        prompt,
        max_tokens_first_chunk: 2048,
      })

      // Add to list and switch
      setStories([...stories, storyName])
      setCurrentStory(storyName)
      setShowSeedAI(false)

      // Step 2: Show entity confirmation if proposals exist
      if (result.proposed_entities && result.proposed_entities.length > 0) {
        setProposedEntities(result.proposed_entities)
        setSelectedEntityNames(new Set(result.proposed_entities.map(e => e.name)))  // Pre-select all
        setCurrentStoryContext({
          story: storyName,
          text: prompt + "\n\n" + result.content
        })
        setShowEntityConfirmation(true)
      } else {
        toast.success('Story starter generated!')
      }
    } catch (error) {
      console.error('Failed to seed story:', error)
      toast.error(`Failed to seed story: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSeeding(false)
    }
  }

  const handleConfirmEntities = async () => {
    if (!currentStoryContext) return

    const selectedNames = Array.from(selectedEntityNames)
    if (selectedNames.length === 0) {
      setShowEntityConfirmation(false)
      setCurrentStoryContext(null)
      toast.info('Story created without lorebook entries')
      return
    }

    setSeeding(true)
    try {
      const result = await generateFromProposals({
        story: currentStoryContext.story,
        story_text: currentStoryContext.text,
        selected_names: selectedNames,
      })

      toast.success(`Created ${result.created} lorebook ${result.created === 1 ? 'entry' : 'entries'}`)
      setShowEntityConfirmation(false)
      setProposedEntities([])
      setSelectedEntityNames(new Set())
      setCurrentStoryContext(null)
    } catch (error) {
      console.error('Failed to generate lorebook:', error)
      toast.error(`Failed to generate lorebook: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSeeding(false)
    }
  }

  const toggleEntitySelection = (name: string) => {
    const newSet = new Set(selectedEntityNames)
    if (newSet.has(name)) {
      newSet.delete(name)
    } else {
      newSet.add(name)
    }
    setSelectedEntityNames(newSet)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setImportText(text || '')
    }
    reader.readAsText(file)
  }

  const handleImportStory = async () => {
    const text = importText.trim()
    if (!text) {
      toast.error('Please enter or upload text to import')
      return
    }

    const base = importName.trim()
    const storyName = base || `Imported ${stories.length + 1}`

    setImporting(true)
    try {
      const result = await importStory({
        story: storyName,
        text,
        generate_lore_proposals: true,
      })

      // Add to list and switch
      setStories([...stories, storyName])
      setCurrentStory(storyName)
      setShowImport(false)

      toast.success(`Imported ${result.chunks_created} chunks (${result.total_characters.toLocaleString()} characters)`)

      // Show entity confirmation if proposals exist
      if (result.proposed_entities && result.proposed_entities.length > 0) {
        setProposedEntities(result.proposed_entities)
        setSelectedEntityNames(new Set(result.proposed_entities.map(e => e.name)))
        setCurrentStoryContext({
          story: storyName,
          text: text,
        })
        setShowEntityConfirmation(true)
      }
    } catch (error) {
      console.error('Failed to import story:', error)
      toast.error(`Failed to import story: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setImporting(false)
    }
  }

  // Prompt preview moved to right sidebar Generation card

  return (
    <>
      {/* Navigation Bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-2 py-3 md:hidden">
          <h1 className="text-xl font-bold text-gray-900">Storycraft</h1>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white p-2 text-gray-700 shadow-sm"
            aria-expanded={isMobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        <div
          className={`${isMobileMenuOpen ? 'block' : 'hidden'} border-t border-gray-100 px-2 pb-3 md:block md:border-t-0 md:px-4 md:py-3`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Left Side - Title */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <h1 className="text-xl font-bold text-gray-900 hidden md:block">Storycraft</h1>

              {/* Story Selector */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 md:gap-4 w-full sm:w-auto">
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <span className="text-sm text-gray-600 whitespace-nowrap">Story:</span>
                  <Select value={currentStory} onValueChange={handleStoryChange}>
                    <SelectTrigger className="w-full min-w-0 sm:w-52 md:w-64 lg:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stories.map((story) => (
                        <SelectItem key={story} value={story}>
                          {story}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCreateStory}
                    className="w-full sm:w-auto text-purple-600 border-purple-200 hover:bg-purple-50"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New Story
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenSeedAI}
                    className="w-full sm:w-auto text-purple-600 border-purple-200 hover:bg-purple-50"
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    New Story (AI)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImportName('')
                      setImportText('')
                      setShowImport(true)
                    }}
                    className="w-full sm:w-auto text-purple-600 border-purple-200 hover:bg-purple-50"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Import Story
                  </Button>
                </div>
                {/* Delete Story action moved to Sidebar */}
              </div>
            </div>

            {/* Right Side - Actions and Status */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 md:justify-end">

              {/* API + LLM Status */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  apiStatus === 'ok'
                    ? 'bg-green-100 text-green-800'
                  : apiStatus === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {apiStatus === 'ok' ? (
                  <CheckCircle className="h-3 w-3" />
                ) : apiStatus === 'error' ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-current animate-pulse" />
                )}
                API {apiStatus === 'checking' ? 'Checking' : apiStatus.toUpperCase()}
              </div>
              
              <button
                onClick={checkLlmStatus}
                disabled={llmStatus === 'checking'}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                  llmStatus === 'ok'
                    ? 'bg-green-100 text-green-800'
                    : llmStatus === 'error'
                    ? 'bg-red-100 text-red-800'
                    : llmStatus === 'unknown'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
                title="Click to check LLM status"
              >
                {llmStatus === 'ok' ? (
                  <CheckCircle className="h-3 w-3" />
                ) : llmStatus === 'error' ? (
                  <AlertCircle className="h-3 w-3" />
                ) : llmStatus === 'checking' ? (
                  <div className="h-3 w-3 rounded-full bg-current animate-pulse" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                LLM {llmStatus === 'checking' ? 'Checking' : llmStatus === 'unknown' ? 'Check' : llmStatus.toUpperCase()}
              </button>

              {(apiMessage || llmMessage) && (
                <div
                  className="text-xs text-gray-500 max-w-full sm:max-w-xs break-words sm:truncate"
                  title={`${apiMessage || ''} ${llmMessage ? ' • ' + llmMessage : ''}`}
                >
                  {apiMessage || llmMessage}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Modals: AI seed only; other modals moved to right sidebar */}

      <Modal
        isOpen={showSeedAI}
        onClose={() => setShowSeedAI(false)}
        title="Create New Story with AI"
        size="lg"
      >
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Story Name (optional)</label>
            <input
              className="w-full border rounded px-2 py-2"
              value={seedName}
              onChange={(e) => setSeedName(e.target.value)}
              placeholder="e.g., The Fallen Spire"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">What is this story about?</label>
            <textarea
              className="w-full border rounded px-2 py-2 min-h-[120px]"
              value={seedPrompt}
              onChange={(e) => setSeedPrompt(e.target.value)}
              placeholder="A haunted archaeologist returns to her hometown…"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSeedStory} disabled={seeding}>
              {seeding ? 'Generating…' : 'Generate Starter'}
            </Button>
            <Button variant="ghost" onClick={() => setShowSeedAI(false)} disabled={seeding}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Story Modal */}
      <Modal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="Import Story from Text"
        size="lg"
      >
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Story Name (optional)</label>
            <input
              className="w-full border rounded px-2 py-2"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder="e.g., My Imported Story"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Story Text (paste or upload .txt file)
            </label>
            <textarea
              className="w-full border rounded px-2 py-2 min-h-[200px] font-mono text-sm"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste your story text here..."
            />
            <div className="mt-2 flex items-center gap-3">
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="text-sm"
              />
              {importText && (
                <span className="text-xs text-gray-500">
                  {importText.length.toLocaleString()} characters (~{Math.round(importText.length / 4).toLocaleString()} tokens)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleImportStory} disabled={importing || !importText.trim()}>
              {importing ? 'Importing...' : 'Import Story'}
            </Button>
            <Button variant="ghost" onClick={() => setShowImport(false)} disabled={importing}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Entity Confirmation Modal */}
      <Modal
        isOpen={showEntityConfirmation}
        onClose={() => {
          if (!seeding) {
            setShowEntityConfirmation(false)
            setProposedEntities([])
            setSelectedEntityNames(new Set())
            setCurrentStoryContext(null)
          }
        }}
        title="Confirm Lorebook Entries"
        size="lg"
      >
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
            Select which entities should get lorebook entries:
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {proposedEntities.map((entity) => (
              <div
                key={entity.name}
                className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleEntitySelection(entity.name)}
              >
                <input
                  type="checkbox"
                  checked={selectedEntityNames.has(entity.name)}
                  onChange={() => toggleEntitySelection(entity.name)}
                  className="mt-1"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <div className="font-medium">
                    {entity.name}
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      ({entity.kind})
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {entity.reason}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500">
            {selectedEntityNames.size} of {proposedEntities.length} selected
          </div>
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button onClick={handleConfirmEntities} disabled={seeding}>
              {seeding ? 'Generating…' : `Generate ${selectedEntityNames.size} ${selectedEntityNames.size === 1 ? 'Entry' : 'Entries'}`}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowEntityConfirmation(false)
                setProposedEntities([])
                setSelectedEntityNames(new Set())
                setCurrentStoryContext(null)
                toast.info('Story created without lorebook entries')
              }}
              disabled={seeding}
            >
              Skip Lorebook
            </Button>
          </div>
        </div>
      </Modal>

    </>
  )
}
