'use client'

import { useState, useEffect } from 'react'
import { 
  GitBranch, 
  BookOpen, 
  Plus, 
  ChevronDown,
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
import { BranchesPanel } from '@/components/sidebar/BranchesPanel'
// import { GenerationSettings } from '@/components/sidebar/GenerationSettings'
import { useAppStore } from '@/stores/appStore'
import { getStories, healthCheck, getPromptPreview } from '@/lib/api'
import { toast } from 'sonner'

export function TopNavigation() {
  const { currentStory, setCurrentStory } = useAppStore()
  const [stories, setStories] = useState<string[]>([])
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [apiMessage, setApiMessage] = useState('')
  
  // Modal states
  // const [showSettings, setShowSettings] = useState(false)
  const [showBranches, setShowBranches] = useState(false)
  const [showPromptPreview, setShowPromptPreview] = useState(false)
  const [promptMessages, setPromptMessages] = useState<Array<{role: string, content: string}>>([])

  useEffect(() => {
    loadStories()
    checkApiStatus()
    
    // Check API status every 30 seconds
    const interval = setInterval(checkApiStatus, 30000)
    return () => clearInterval(interval)
  }, [])

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

  const handleShowPromptPreview = async () => {
    try {
      const result = await getPromptPreview(currentStory, '', undefined)
      setPromptMessages(result.messages || [])
      setShowPromptPreview(true)
    } catch (error) {
      console.error('Failed to get prompt preview:', error)
      toast.error(`Failed to get prompt preview: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'system': return 'bg-purple-100 text-purple-800'
      case 'user': return 'bg-blue-100 text-blue-800'
      case 'assistant': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

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
            </div>
          </div>

          {/* Right Side - Actions and Status */}
          <div className="flex items-center gap-3">
            {/* Action Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBranches(true)}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              <GitBranch className="h-4 w-4 mr-1" />
              Branches
            </Button>
            
            {/* Settings moved to right sidebar; button removed */}

            <Button
              variant="outline"
              size="sm"
              onClick={handleShowPromptPreview}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Preview Prompt
            </Button>

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

      {/* Modals */}
      {/* Settings modal removed; use sidebar controls */}

      <Modal
        isOpen={showBranches}
        onClose={() => setShowBranches(false)}
        title="Story Branches"
        size="lg"
        position="right"
      >
        <div className="p-4 h-full overflow-y-auto">
          <BranchesPanel />
        </div>
      </Modal>

      <Modal
        isOpen={showPromptPreview}
        onClose={() => setShowPromptPreview(false)}
        title="Generation Prompt Preview"
        size="lg"
      >
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-3">
            {promptMessages.map((message, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getRoleColor(message.role)}`}>
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
    </>
  )
}
