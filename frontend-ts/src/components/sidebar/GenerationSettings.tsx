'use client'

import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/stores/appStore'

export function GenerationSettings() {
  const { generationSettings, updateGenerationSettings, instruction } = useAppStore()
  const temp = Number.isFinite(generationSettings.temperature as any)
    ? (generationSettings.temperature as number)
    : 0.7
  const base = generationSettings.base_instruction || 'Continue the story, matching established voice, tone, and point of view. Maintain continuity with prior events and details.'
  const userInstr = (instruction || '').trim()
  const merged = userInstr
    ? `${base}\n\nFollow this direction for the continuation:\n${userInstr}`
    : base

  return (
    <div className="space-y-4">
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
        <label className="text-sm font-medium">Instruction preview</label>
        <div className="mt-2 border rounded bg-gray-50 p-2">
          <pre className="whitespace-pre-wrap text-xs text-gray-700">{merged}</pre>
        </div>
      </div>

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
