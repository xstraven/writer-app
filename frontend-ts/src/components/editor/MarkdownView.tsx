'use client'

import MarkdownIt from 'markdown-it'
import { useMemo } from 'react'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
})

interface MarkdownViewProps {
  content: string
  className?: string
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  const html = useMemo(() => md.render(content || ''), [content])
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

