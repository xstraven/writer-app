'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface TipTapComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function TipTapComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Write your instruction here...",
  className,
  disabled = false,
}: TipTapComposerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Extension.create({
        name: 'submitShortcut',
        addKeyboardShortcuts() {
          return {
            'Mod-Enter': () => {
              if (onSubmit) {
                const text = this.editor.getText()
                console.log('Cmd+Enter pressed, submitting:', text)
                onSubmit(text)
                // Clear the editor after submit
                this.editor.commands.clearContent()
                return true
              }
              return false
            },
          }
        },
      }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false, // Fix SSR hydration issues
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      onChange(text)
    },
  })

  // Update content when value prop changes
  useEffect(() => {
    if (editor && value !== editor.getText()) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  return (
    <div 
      className={cn(
        "min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60px] [&_.ProseMirror]:p-0"
      />
    </div>
  )
}