'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface AddChunkModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (text: string) => void
  isLoading?: boolean
}

export function AddChunkModal({ isOpen, onClose, onSubmit, isLoading = false }: AddChunkModalProps) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text.trim())
      setText('')
      onClose()
    }
  }

  const handleClose = () => {
    setText('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add User Chunk" size="md">
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="chunk-text">Chunk Text</Label>
          <Textarea
            id="chunk-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the text for your new story chunk..."
            className="min-h-[120px]"
            autoFocus
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <p className="text-sm text-gray-500">Press Ctrl+Enter to add the chunk quickly</p>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!text.trim() || isLoading}
          >
            {isLoading ? 'Adding...' : 'Add Chunk'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}