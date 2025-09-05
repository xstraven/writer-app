'use client'

import { useState, useEffect } from 'react'
import { 
  BookOpen, 
  Plus, 
  AlertCircle,
  CheckCircle,
  Sparkles
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
import { getStories, healthCheck, seedStoryAI } from '@/lib/api'
import { toast } from 'sonner'

export function TopNavigation() {
  const { currentStory, setCurrentStory } = useAppStore()
  const [stories, setStories] = useState<string[]>([])
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [apiMessage, setApiMessage] = useState('')
  
  // Modal: AI seed
  const [showSeedAI, setShowSeedAI] = useState(false)
  const [seedName, setSeedName] = useState('')
  const [seedPrompt, setSeedPrompt] = useState('')
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    loadStories()
    checkApiStatus()
    
    // Check API status every 30 seconds
    const interval = setInterval(checkApiStatus, 30000)
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

  const handleCreateStory = () => {
    const storyName = prompt('Enter new story name:')
    if (storyName && storyName.trim()) {
      const newStoryName = storyName.trim()
      setStories([...stories, newStoryName])
      setCurrentStory(newStoryName)
      toast.success(`Story "${newStoryName}" created`)
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
      await seedStoryAI({
        story: storyName,
        prompt,
        // Keep the first chunk small to avoid timeouts
        max_tokens_first_chunk: 200,
        // Model/params can be wired from settings later if needed
      })
      // Add to list and switch
      setStories([...stories, storyName])
      setCurrentStory(storyName)
      setShowSeedAI(false)
      toast.success('Starter generated')
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
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left Side - Title */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Storycraft</h1>
            
            {/* Story Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Story:</span>
              <Select value={currentStory} onValueChange={setCurrentStory}>
                <SelectTrigger className="w-48">
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
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateStory}
                className="text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Story
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenSeedAI}
                className="text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                New Story (AI)
              </Button>
              {/* Delete Story action moved to Sidebar */}
            </div>
          </div>

          {/* Right Side - Actions and Status */}
          <div className="flex items-center gap-3">

            {/* API Status */}
            <div className="flex items-center gap-2">
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
              
              {apiMessage && (
                <div className="hidden sm:block text-xs text-gray-500 max-w-xs truncate" title={apiMessage}>
                  {apiMessage}
                </div>
              )}
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
