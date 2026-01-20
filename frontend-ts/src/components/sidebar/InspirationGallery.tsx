'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'
import { uploadGalleryImage, deleteGalleryImage } from '@/lib/api'
import type { GalleryItem } from '@/lib/types'

export function InspirationGallery() {
  const { currentStory, gallery, addGalleryImage, removeGalleryImage } = useAppStore()
  const [url, setUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddUrl = () => {
    const trimmed = url.trim()
    if (!trimmed) return

    const item: GalleryItem = {
      type: 'url',
      value: trimmed,
    }
    addGalleryImage(item)
    setUrl('')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)

    try {
      const result = await uploadGalleryImage(currentStory, file)
      const item: GalleryItem = {
        type: 'upload',
        value: result.filename,
        display_name: result.original_filename,
        uploaded_at: new Date().toISOString(),
      }
      addGalleryImage(item)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = async (item: GalleryItem) => {
    if (item.type === 'upload') {
      try {
        await deleteGalleryImage(currentStory, item.value)
      } catch (err) {
        console.error('Failed to delete image:', err)
      }
    }
    removeGalleryImage(item)
  }

  const getImageUrl = (item: GalleryItem): string => {
    if (item.type === 'url') {
      return item.value
    }
    const apiBase = process.env.NEXT_PUBLIC_STORYCRAFT_API_BASE || 'http://localhost:8000'
    return `${apiBase}/api/images/${currentStory}/${item.value}`
  }

  return (
    <div className="space-y-3">
      {/* URL Input */}
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste image URL"
          className="text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddUrl() }}
        />
        <Button size="sm" onClick={handleAddUrl} disabled={!url.trim()}>
          Add URL
        </Button>
      </div>

      {/* File Upload */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          id="gallery-file-upload"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Upload Image'}
        </Button>
      </div>

      {uploadError && (
        <p className="text-xs text-red-600">{uploadError}</p>
      )}

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 gap-3">
        {gallery.length === 0 && (
          <p className="text-xs text-neutral-500">
            Add portrait images as scene references.
          </p>
        )}
        {gallery.map((item, idx) => (
          <div
            key={`${item.type}-${item.value}-${idx}`}
            className="relative border rounded-md bg-white overflow-hidden"
          >
            <img
              src={getImageUrl(item)}
              alt={item.display_name || 'Inspiration'}
              loading="lazy"
              className="w-full h-auto object-contain block bg-neutral-50"
            />
            <div className="absolute top-1 right-1 flex gap-1">
              {item.type === 'upload' && (
                <span className="bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
                  Uploaded
                </span>
              )}
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7"
                onClick={() => handleRemove(item)}
                title="Remove image"
              >
                ×
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
