'use client'

import { StoryEditor } from '@/components/editor/StoryEditor'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { TopNavigation } from '@/components/layout/TopNavigation'

export default function Home() {
  return (
    <div className="w-full min-h-screen bg-neutral-50 text-neutral-900">
      {/* Top Navigation */}
      <TopNavigation />

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor Column */}
        <div className="lg:col-span-8">
          <StoryEditor />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4">
          <Sidebar />
        </div>
      </div>
    </div>
  )
}