'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GenerationSettings } from './GenerationSettings'
import { ContextTabs } from './ContextTabs'

export function Sidebar() {
  return (
    <div className="space-y-4">
      {/* Generation Settings */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Generation Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerationSettings />
        </CardContent>
      </Card>

      {/* Context Management */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Context</CardTitle>
        </CardHeader>
        <CardContent>
          <ContextTabs />
        </CardContent>
      </Card>
    </div>
  )
}