'use client'

import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useAppStore } from '@/stores/appStore'

export function GenerationSettings() {
  const { generationSettings, updateGenerationSettings } = useAppStore()

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="temp" className="text-sm font-medium">Temperature</label>
          <span className="text-sm text-neutral-500">
            {generationSettings.temperature.toFixed(2)}
          </span>
        </div>
        <Slider
          id="temp"
          min={0}
          max={1}
          step={0.01}
          value={[generationSettings.temperature]}
          onValueChange={(value) => updateGenerationSettings({ temperature: value[0] })}
          className="mt-2"
        />
      </div>

      <div>
        <label htmlFor="maxtokens" className="text-sm font-medium">Max tokens</label>
        <Input
          id="maxtokens"
          type="number"
          min={1}
          max={8192}
          value={generationSettings.max_tokens}
          onChange={(e) => updateGenerationSettings({ max_tokens: Number(e.target.value) })}
          className="mt-2"
        />
      </div>
    </div>
  )
}