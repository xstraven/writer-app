'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'

export function InspirationGallery() {
  const { gallery, addGalleryImage, removeGalleryImage } = useAppStore()
  const [url, setUrl] = useState('')

  const handleAdd = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    addGalleryImage(trimmed)
    setUrl('')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste image URL (portrait)"
          className="text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <Button size="sm" onClick={handleAdd} disabled={!url.trim()}>Add</Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {gallery.length === 0 && (
          <p className="text-xs text-neutral-500">Add portrait images as scene references.</p>
        )}
        {gallery.map((src) => (
          <div key={src} className="relative border rounded-md bg-white overflow-hidden">
            <img 
              src={src} 
              alt="Inspiration" 
              loading="lazy"
              className="w-full h-auto object-contain block bg-neutral-50"
            />
            <div className="absolute top-1 right-1">
              <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => removeGalleryImage(src)} title="Remove image">×</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
