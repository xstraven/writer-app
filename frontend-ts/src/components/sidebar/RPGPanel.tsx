'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/stores/appStore'
import {
  setupRPGSession,
  performRPGAction,
  getRPGState,
} from '@/lib/api'
import { toast } from 'sonner'
import type { RPGActionResult, CharacterSheet } from '@/lib/types'
import { Dices, Swords, Heart, Shield, User, Scroll, Package, ChevronDown, ChevronRight } from 'lucide-react'

export function RPGPanel() {
  const {
    currentStory,
    rpgModeSettings,
    setRpgModeSettings,
    generationSettings,
  } = useAppStore()

  // Setup form state
  const [worldSetting, setWorldSetting] = useState('')
  const [characterName, setCharacterName] = useState('')
  const [characterClass, setCharacterClass] = useState('')
  const [numPartyMembers, setNumPartyMembers] = useState(0)
  const [isSettingUp, setIsSettingUp] = useState(false)

  // Action state
  const [actionInput, setActionInput] = useState('')
  const [isPerformingAction, setIsPerformingAction] = useState(false)
  const [lastResults, setLastResults] = useState<RPGActionResult[]>([])
  const [suggestedActions, setSuggestedActions] = useState<string[]>([])

  // UI state
  const [showCharacter, setShowCharacter] = useState(true)
  const [showGameSystem, setShowGameSystem] = useState(false)
  const [showInventory, setShowInventory] = useState(false)
  const [showParty, setShowParty] = useState(false)

  // Load RPG state when story changes
  useEffect(() => {
    const loadRPGState = async () => {
      if (!currentStory) return
      try {
        const state = await getRPGState(currentStory)
        if (state && state.enabled) {
          setRpgModeSettings(state)
        } else {
          setRpgModeSettings(undefined)
        }
      } catch {
        setRpgModeSettings(undefined)
      }
    }
    loadRPGState()
  }, [currentStory, setRpgModeSettings])

  const handleSetup = async () => {
    if (!currentStory || !worldSetting.trim()) {
      toast.error('Please enter a world setting description')
      return
    }

    setIsSettingUp(true)
    try {
      const response = await setupRPGSession({
        story: currentStory,
        world_setting: worldSetting,
        character_name: characterName || undefined,
        character_class: characterClass || undefined,
        num_party_members: numPartyMembers,
        model: generationSettings.model,
        temperature: generationSettings.temperature,
      })

      setRpgModeSettings({
        enabled: true,
        world_setting: worldSetting,
        game_system: response.game_system,
        player_character: response.player_character,
        party_members: response.party_members,
        current_quest: 'Begin the adventure',
        quest_log: ['Started a new adventure'],
        session_notes: '',
      })
      setSuggestedActions(response.available_actions)
      toast.success('RPG session initialized!')
    } catch (error) {
      console.error('Failed to setup RPG session:', error)
      toast.error('Failed to setup RPG session')
    } finally {
      setIsSettingUp(false)
    }
  }

  const handleAction = async (action?: string) => {
    const actionText = action || actionInput.trim()
    if (!currentStory || !actionText) {
      toast.error('Please enter an action')
      return
    }

    setIsPerformingAction(true)
    setLastResults([])
    try {
      const response = await performRPGAction({
        story: currentStory,
        action: actionText,
        use_dice: true,
        model: generationSettings.model,
        temperature: generationSettings.temperature,
      })

      setLastResults(response.action_results)
      setSuggestedActions(response.available_actions)
      setActionInput('')

      if (response.character_updates) {
        setRpgModeSettings({
          ...rpgModeSettings!,
          player_character: response.character_updates,
        })
      }
    } catch (error) {
      console.error('Failed to perform action:', error)
      toast.error('Failed to perform action')
    } finally {
      setIsPerformingAction(false)
    }
  }

  const resetRPGMode = () => {
    setRpgModeSettings(undefined)
    setWorldSetting('')
    setCharacterName('')
    setCharacterClass('')
    setNumPartyMembers(0)
    setLastResults([])
    setSuggestedActions([])
  }

  // If RPG mode is not set up, show setup form
  if (!rpgModeSettings?.enabled) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Start a pen-and-paper style RPG adventure. Describe your world and the AI will generate a simple game system and adventure for you.
        </div>

        <div>
          <label className="text-sm font-medium">World Setting *</label>
          <Textarea
            value={worldSetting}
            onChange={(e) => setWorldSetting(e.target.value)}
            placeholder="Describe your world... (e.g., 'A dark fantasy realm where magic is forbidden and ancient dragons sleep beneath the mountains')"
            className="mt-1 min-h-[100px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Character Name</label>
            <Input
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="Your hero's name"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Class/Role</label>
            <Input
              value={characterClass}
              onChange={(e) => setCharacterClass(e.target.value)}
              placeholder="e.g., Warrior, Mage"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Party Members</label>
          <select
            value={numPartyMembers}
            onChange={(e) => setNumPartyMembers(Number(e.target.value))}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          >
            <option value={0}>Solo Adventure</option>
            <option value={1}>1 Companion</option>
            <option value={2}>2 Companions</option>
            <option value={3}>3 Companions</option>
          </select>
        </div>

        <Button
          onClick={handleSetup}
          disabled={isSettingUp || !worldSetting.trim()}
          className="w-full"
        >
          {isSettingUp ? (
            <>
              <Dices className="w-4 h-4 mr-2 animate-spin" />
              Creating Adventure...
            </>
          ) : (
            <>
              <Dices className="w-4 h-4 mr-2" />
              Start RPG Adventure
            </>
          )}
        </Button>
      </div>
    )
  }

  // RPG mode is active - show game UI
  const character = rpgModeSettings.player_character
  const gameSystem = rpgModeSettings.game_system

  return (
    <div className="space-y-4">
      {/* Character Overview */}
      {character && (
        <div className="border rounded-lg p-3 bg-card">
          <button
            onClick={() => setShowCharacter(!showCharacter)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="font-medium">{character.name}</span>
              <span className="text-xs text-muted-foreground">
                Lv.{character.level} {character.character_class}
              </span>
            </div>
            {showCharacter ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {showCharacter && (
            <div className="mt-3 space-y-3">
              {/* Health Bar */}
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${(character.health / character.max_health) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono">{character.health}/{character.max_health}</span>
              </div>

              {/* Attributes */}
              <div className="grid grid-cols-2 gap-2">
                {character.attributes.map((attr) => (
                  <div key={attr.name} className="flex justify-between text-xs bg-muted/50 px-2 py-1 rounded">
                    <span>{attr.name}</span>
                    <span className="font-mono font-bold">{attr.value}</span>
                  </div>
                ))}
              </div>

              {/* Skills */}
              {character.skills.length > 0 && (
                <div className="text-xs">
                  <span className="font-medium">Skills: </span>
                  {character.skills.map(s => `${s.name} (${s.level})`).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inventory */}
      {character && character.inventory.length > 0 && (
        <div className="border rounded-lg p-3 bg-card">
          <button
            onClick={() => setShowInventory(!showInventory)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="font-medium">Inventory</span>
              <span className="text-xs text-muted-foreground">
                ({character.inventory.length} items)
              </span>
            </div>
            {showInventory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {showInventory && (
            <div className="mt-2 space-y-1">
              {character.inventory.map((item, idx) => (
                <div key={idx} className="text-xs flex justify-between items-center bg-muted/50 px-2 py-1 rounded">
                  <span>{item.name}</span>
                  {item.quantity > 1 && <span className="text-muted-foreground">x{item.quantity}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Party Members */}
      {rpgModeSettings.party_members.length > 0 && (
        <div className="border rounded-lg p-3 bg-card">
          <button
            onClick={() => setShowParty(!showParty)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="font-medium">Party</span>
              <span className="text-xs text-muted-foreground">
                ({rpgModeSettings.party_members.length} companions)
              </span>
            </div>
            {showParty ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {showParty && (
            <div className="mt-2 space-y-2">
              {rpgModeSettings.party_members.map((member, idx) => (
                <PartyMemberCard key={idx} member={member} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Game System */}
      {gameSystem && (
        <div className="border rounded-lg p-3 bg-card">
          <button
            onClick={() => setShowGameSystem(!showGameSystem)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Scroll className="w-4 h-4" />
              <span className="font-medium">{gameSystem.name}</span>
            </div>
            {showGameSystem ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {showGameSystem && (
            <div className="mt-2 space-y-2 text-xs">
              <p><strong>Core Mechanic:</strong> {gameSystem.core_mechanic}</p>
              {gameSystem.skill_check_rules && (
                <p><strong>Skill Checks:</strong> {gameSystem.skill_check_rules}</p>
              )}
              {gameSystem.combat_rules && (
                <p><strong>Combat:</strong> {gameSystem.combat_rules}</p>
              )}
              {Object.keys(gameSystem.difficulty_levels).length > 0 && (
                <p>
                  <strong>Difficulty: </strong>
                  {Object.entries(gameSystem.difficulty_levels)
                    .map(([name, dc]) => `${name} (DC ${dc})`)
                    .join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Last Dice Results */}
      {lastResults.length > 0 && (
        <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 mb-2">
            <Dices className="w-4 h-4 text-amber-600" />
            <span className="font-medium text-sm">Dice Results</span>
          </div>
          <div className="space-y-1">
            {lastResults.map((result, idx) => (
              <div
                key={idx}
                className={`text-xs p-2 rounded ${
                  result.success
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                }`}
              >
                <div className="font-medium">{result.check_type}</div>
                <div className="font-mono">
                  Rolled {result.roll_result} + {result.modifier} = {result.total} vs DC {result.target_number}
                </div>
                <div className="font-bold">{result.success ? 'SUCCESS!' : 'FAILED'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Swords className="w-4 h-4" />
          What do you do?
        </label>
        <Textarea
          value={actionInput}
          onChange={(e) => setActionInput(e.target.value)}
          placeholder="Describe your action... (e.g., 'I approach the guard and try to convince him to let me pass')"
          className="min-h-[60px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleAction()
            }
          }}
        />
        <Button
          onClick={() => handleAction()}
          disabled={isPerformingAction || !actionInput.trim()}
          className="w-full"
        >
          {isPerformingAction ? (
            <>
              <Dices className="w-4 h-4 mr-2 animate-spin" />
              Rolling...
            </>
          ) : (
            <>
              <Dices className="w-4 h-4 mr-2" />
              Take Action
            </>
          )}
        </Button>
      </div>

      {/* Suggested Actions */}
      {suggestedActions.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Quick Actions:</label>
          <div className="flex flex-wrap gap-1">
            {suggestedActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(action)}
                disabled={isPerformingAction}
                className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded border transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reset Button */}
      <div className="pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={resetRPGMode}
          className="w-full text-red-600 hover:text-red-700"
        >
          End RPG Session
        </Button>
      </div>
    </div>
  )
}

function PartyMemberCard({ member }: { member: CharacterSheet }) {
  return (
    <div className="bg-muted/50 p-2 rounded text-xs">
      <div className="flex justify-between items-center">
        <span className="font-medium">{member.name}</span>
        <span className="text-muted-foreground">Lv.{member.level} {member.character_class}</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <Heart className="w-3 h-3 text-red-500" />
        <span className="font-mono">{member.health}/{member.max_health}</span>
      </div>
    </div>
  )
}
