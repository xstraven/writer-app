'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Users, BookOpen, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceInput } from '@/components/ui/voice-input';
import { createCampaign } from '@/lib/api';
import { useCampaignStore } from '@/stores/campaignStore';
import { toast } from 'sonner';

// Default to OpenAI model for voice-enabled campaigns (better for multimodal)
const DEFAULT_VOICE_MODEL = 'openai/gpt-4o';

type GameTone = 'family_friendly' | 'all_ages' | 'mature';
type GameStyle = 'narrative' | 'mechanical' | 'hybrid';

export function CreateCampaignForm() {
  const router = useRouter();
  const { playerName, setPlayerName, addCampaign } = useCampaignStore();

  const [isCreating, setIsCreating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    worldSetting: '',
    playerName: playerName || '',
    characterName: '',
    characterConcept: '',  // Renamed from characterClass for narrative focus
    characterSpecial: '',  // New: what makes them unique
    tone: 'all_ages' as GameTone,
    style: 'narrative' as GameStyle,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.worldSetting.trim() || !formData.playerName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);

    try {
      const response = await createCampaign({
        name: formData.name.trim(),
        world_setting: formData.worldSetting.trim(),
        player_name: formData.playerName.trim(),
        character_name: formData.characterName.trim() || undefined,
        character_class: formData.characterConcept.trim() || undefined,
        character_special: formData.characterSpecial.trim() || undefined,
        model: DEFAULT_VOICE_MODEL,
        tone: formData.tone,
        style: formData.style,
      });

      // Save player name for future use
      setPlayerName(formData.playerName.trim());

      // Add to campaigns list
      addCampaign({
        campaign: response.campaign,
        players: [response.player],
        your_player: response.player,
      });

      toast.success('Adventure created! Share the invite code with friends.');
      router.push(`/campaigns/${response.campaign.id}`);
    } catch (error: any) {
      console.error('Failed to create campaign:', error);
      toast.error(error.response?.data?.detail || 'Failed to create adventure');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Create New Adventure
        </CardTitle>
        <CardDescription>
          Set up your world and character. The AI will generate a game system tailored to your setting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Adventure Name *</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                placeholder="The Quest for the Dragon's Hoard"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isCreating}
                className="flex-1"
              />
              <VoiceInput
                onTranscript={(text) => setFormData({ ...formData, name: text })}
                disabled={isCreating}
                continuous={false}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="worldSetting">World Setting *</Label>
              <div className="flex items-center gap-2">
                <VoiceInput
                  onTranscript={(text) => {
                    setFormData({ ...formData, worldSetting: text });
                    setIsRecording(false);
                  }}
                  onPartialTranscript={(text) => {
                    setFormData({ ...formData, worldSetting: text });
                    setIsRecording(true);
                  }}
                  disabled={isCreating}
                />
                <span className="text-xs text-muted-foreground">
                  {isRecording ? 'Listening...' : 'or use voice'}
                </span>
              </div>
            </div>
            <Textarea
              id="worldSetting"
              placeholder="Describe your world: the setting, tone, and any important details. For example: 'A dark fantasy realm where the undead have risen and the last bastions of humanity fight for survival. Magic is rare and dangerous.'

You can also click the microphone button to describe your world using voice input."
              className="min-h-[150px]"
              value={formData.worldSetting}
              onChange={(e) => setFormData({ ...formData, worldSetting: e.target.value })}
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              The AI will create a custom game system based on your world description.
            </p>
          </div>

          {/* Game Style Options */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-4">Adventure Style</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Tone Selection */}
              <div className="space-y-2">
                <Label>Who's Playing?</Label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'family_friendly', label: 'Family Fun', desc: 'Great for kids! No scary stuff.' },
                    { value: 'all_ages', label: 'All Ages', desc: 'Mild adventure peril, suitable for everyone.' },
                    { value: 'mature', label: 'Mature', desc: 'Realistic stakes and consequences.' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, tone: option.value as GameTone })}
                      disabled={isCreating}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        formData.tone === option.value
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Selection */}
              <div className="space-y-2">
                <Label>Game Style</Label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'narrative', label: 'Collaborative Story', desc: 'Focus on storytelling. Simple dice, big imagination!', icon: BookOpen },
                    { value: 'hybrid', label: 'Story + Light Rules', desc: 'Storytelling with some game mechanics.', icon: Users },
                    { value: 'mechanical', label: 'Classic RPG', desc: 'Traditional rules with dice and stats.', icon: Swords },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, style: option.value as GameStyle })}
                      disabled={isCreating}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        formData.style === option.value
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Character Creation */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-4">Your Character</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="playerName">Your Name *</Label>
                <Input
                  id="playerName"
                  placeholder="Your display name"
                  value={formData.playerName}
                  onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="characterName">Character Name</Label>
                <Input
                  id="characterName"
                  placeholder="Thorin, Aria, Luna..."
                  value={formData.characterName}
                  onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="characterConcept">
                  {formData.style === 'narrative' ? 'Who is your character?' : 'Character Class/Role'}
                </Label>
                <Input
                  id="characterConcept"
                  placeholder={formData.style === 'narrative'
                    ? "A curious young wizard, a brave knight, a clever inventor..."
                    : "Warrior, Mage, Rogue, Healer..."
                  }
                  value={formData.characterConcept}
                  onChange={(e) => setFormData({ ...formData, characterConcept: e.target.value })}
                  disabled={isCreating}
                />
              </div>

              {formData.style === 'narrative' && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="characterSpecial">What makes them special? (optional)</Label>
                  <Input
                    id="characterSpecial"
                    placeholder="Can talk to animals, has a magic compass, never gives up..."
                    value={formData.characterSpecial}
                    onChange={(e) => setFormData({ ...formData, characterSpecial: e.target.value })}
                    disabled={isCreating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Give your character a unique gift, talent, or trait that makes them memorable!
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/')}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating} className="flex-1">
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Adventure...
                </>
              ) : (
                'Create Adventure'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
