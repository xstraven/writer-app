'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Menu,
  X
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
import { getStories, healthCheck, llmHealthCheck, seedStoryAI, appendSnippet } from '@/lib/api'
import { toast } from 'sonner'

export function TopNavigation() {
  const { currentStory, setCurrentStory } = useAppStore()
  const [stories, setStories] = useState<string[]>([])
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [apiMessage, setApiMessage] = useState('')
  const [llmStatus, setLlmStatus] = useState<'checking' | 'ok' | 'error'>('checking')
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

  useEffect(() => {
    loadStories()
    checkApiStatus()
    checkLlmStatus()
    
    // Check API status every 30 seconds
    const interval = setInterval(() => {
      checkApiStatus()
      checkLlmStatus()
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
      const result = await seedStoryAI({
        story: storyName,
        prompt,
        max_tokens_first_chunk: 2048,
        // Model/params can be wired from settings later if needed
      })
      // Add to list and switch
      setStories([...stories, storyName])
      setCurrentStory(storyName)
      setShowSeedAI(false)
      toast.success(
        result.generated_lore_count > 0
          ? `Starter generated! Created ${result.generated_lore_count} lorebook ${result.generated_lore_count === 1 ? 'entry' : 'entries'}.`
          : 'Starter generated'
      )
    } catch (error) {
      console.error('Failed to seed story:', error)
      toast.error(`Failed to seed story: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSeeding(false)
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
              
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                llmStatus === 'ok' 
                  ? 'bg-green-100 text-green-800'
                  : llmStatus === 'error'
                  ? 'bg-red-100 text-red-800'  
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {llmStatus === 'ok' ? (
                  <CheckCircle className="h-3 w-3" />
                ) : llmStatus === 'error' ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <div className="h-3 w-3 rounded-full bg-current animate-pulse" />
                )}
                LLM {llmStatus === 'checking' ? 'Checking' : llmStatus.toUpperCase()}
              </div>

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

    </>
  )
}
