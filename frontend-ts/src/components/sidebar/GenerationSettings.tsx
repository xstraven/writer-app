'use client'

import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/stores/appStore'

export function GenerationSettings() {
  const { generationSettings, updateGenerationSettings, chunks } = useAppStore()
  const temp = Number.isFinite(generationSettings.temperature as any)
    ? (generationSettings.temperature as number)
    : 0.7

  // Calculate current story length
  const storyText = chunks.map(c => c.text).join('\n\n')
  const storyChars = storyText.length
  const maxContextChars = Math.max(0, Math.floor((generationSettings.max_context_window ?? 0) * 3))
  const usagePercent = maxContextChars > 0 ? Math.round((storyChars / maxContextChars) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Show initial prompt if available */}
      {generationSettings.initial_prompt && (
        <div className="mb-4 p-3 bg-gray-50 rounded border">
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Original Story Prompt
          </label>
          <div className="text-sm text-gray-800 whitespace-pre-wrap">
            {generationSettings.initial_prompt}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="model" className="text-sm font-medium">Model</label>
        <Input
          id="model"
          type="text"
          value={generationSettings.model || ''}
          onChange={(e) => updateGenerationSettings({ model: e.target.value })}
          placeholder="deepseek/deepseek-chat-v3-0324"
          className="mt-2"
        />
        <p className="mt-1 text-xs text-neutral-500">Default if blank: deepseek/deepseek-chat-v3-0324</p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="temp" className="text-sm font-medium">Temperature</label>
          <span className="text-sm text-neutral-500">{temp.toFixed(2)}</span>
        </div>
        <Slider
          id="temp"
          min={0}
          max={2}
          step={0.01}
          value={[temp]}
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

      <div>
        <label htmlFor="maxcontext" className="text-sm font-medium">Max context window</label>
        <Input
          id="maxcontext"
          type="number"
          min={0}
          step={1}
          value={generationSettings.max_context_window ?? 0}
          onChange={(e) => updateGenerationSettings({ max_context_window: Math.max(0, Number(e.target.value)) })}
          className="mt-2"
        />
        <p className="mt-1 text-xs text-neutral-500">Story text in prompt is truncated from the top to 3× this value (characters).</p>
        {maxContextChars > 0 && (
          <div className="mt-2 p-2 bg-gray-50 rounded border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Current usage:</span>
              <span className={`font-medium ${usagePercent > 100 ? 'text-orange-600' : 'text-gray-800'}`}>
                {storyChars.toLocaleString()} / {maxContextChars.toLocaleString()} chars ({usagePercent}%)
              </span>
            </div>
            <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${usagePercent > 100 ? 'bg-orange-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="baseinstr" className="text-sm font-medium">Default instruction</label>
        <Textarea
          id="baseinstr"
          value={generationSettings.base_instruction || ''}
          onChange={(e) => updateGenerationSettings({ base_instruction: e.target.value })}
          placeholder="Base guidance applied to every continuation"
          className="mt-2 min-h-[90px] text-sm"
        />
      </div>

      <div>
        <label htmlFor="systemprompt" className="text-sm font-medium">System prompt</label>
        <Textarea
          id="systemprompt"
          value={generationSettings.system_prompt || ''}
          onChange={(e) => updateGenerationSettings({ system_prompt: e.target.value })}
          placeholder="High-level guide for the model's behavior, style, and constraints..."
          className="mt-2 min-h-[100px] text-sm"
        />
      </div>
    </div>
  )
}
