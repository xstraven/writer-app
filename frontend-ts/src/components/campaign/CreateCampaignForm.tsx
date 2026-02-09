'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Users, BookOpen, Swords, Wand2, Dices, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceInput } from '@/components/ui/voice-input';
import { createCampaign, generateWorldConcept, addLocalPlayersBatch } from '@/lib/api';
import { useCampaignStore } from '@/stores/campaignStore';
import { WorldBuilder } from './WorldBuilder';
import { toast } from 'sonner';
import type { ProposedLoreEntry } from '@/lib/types';

// Default to OpenAI model for voice-enabled campaigns (better for multimodal)
const DEFAULT_VOICE_MODEL = 'openai/gpt-4o';

type GameTone = 'family_friendly' | 'all_ages' | 'mature';
type GameStyle = 'narrative' | 'mechanical' | 'hybrid';

interface AdventureTemplate {
  title: string;
  tagline: string;
  emoji: string;
  name: string;
  worldSetting: string;
  tone: GameTone;
  style: GameStyle;
  characterConcept: string;
  characterSpecial: string;
}

const ADVENTURE_TEMPLATES: AdventureTemplate[] = [
  {
    title: 'Dragon\'s Peak',
    tagline: 'Classic fantasy quest to slay a dragon',
    emoji: '\uD83D\uDC09',
    name: 'The Dragon of Ashenmount',
    worldSetting: 'The kingdom of Valdris lives in the shadow of Ashenmount, a volcanic peak where the ancient red dragon Scorrath has awoken after centuries of slumber. Villages burn, livestock vanishes, and the king\'s armies have failed. A band of unlikely heroes — gathered at the last free tavern in the foothills — must climb the mountain, navigate its treacherous caverns, and confront the dragon before the entire realm is reduced to cinders. Ancient dwarven tunnels, enchanted forests, and a cunning dragon who speaks in riddles await.',
    tone: 'all_ages',
    style: 'narrative',
    characterConcept: 'A young village blacksmith who dreams of adventure',
    characterSpecial: 'Can sense the heat of dragon-fire before it strikes',
  },
  {
    title: 'Star Wanderers',
    tagline: 'Sci-fi exploration of a ghost ship',
    emoji: '\uD83D\uDE80',
    name: 'The Silent Meridian',
    worldSetting: 'The year is 3147. Your salvage crew aboard the tugship Penelope has picked up a distress beacon from the UES Meridian — a colony ship that vanished 80 years ago carrying 10,000 settlers. Now it drifts in the Oort Cloud, dark and silent. Scans show life support is active but no life signs. The ship\'s AI is still running, sending garbled warnings. Your crew needs the salvage money, but something went very wrong on the Meridian. Flickering lights, sealed bulkheads, and log entries that stop mid-sentence hint at a mystery that could change humanity\'s understanding of deep space.',
    tone: 'mature',
    style: 'hybrid',
    characterConcept: 'A veteran salvage engineer with a troubled past',
    characterSpecial: 'Has an uncanny intuition for mechanical systems — can "hear" when machines are wrong',
  },
  {
    title: 'Enchanted Academy',
    tagline: 'Magical school adventure for all ages',
    emoji: '\u2728',
    name: 'Secrets of Thornberry Academy',
    worldSetting: 'Thornberry Academy is a grand, sprawling school of magic hidden in an enchanted forest where the trees whisper and the hallways rearrange themselves on weekends. Students learn potion-brewing, creature-taming, and spell-weaving. But this semester, something strange is happening: paintings are going blank, the library books are rewriting themselves, and a mysterious door has appeared in the basement that no teacher will talk about. The headmaster has gone on an unexplained "sabbatical." It\'s up to a group of first-year students to uncover the secret before the whole academy unravels.',
    tone: 'family_friendly',
    style: 'narrative',
    characterConcept: 'An eager first-year student who got their acceptance letter by surprise',
    characterSpecial: 'Can talk to the school\'s magical creatures and understand their warnings',
  },
];

const GENRE_STARTERS: Record<string, { label: string; prompt: string }> = {
  fantasy: {
    label: 'Fantasy',
    prompt: 'A magical realm of kingdoms, dragons, and ancient prophecies. Heroes wield swords and sorcery as they quest across enchanted lands.',
  },
  scifi: {
    label: 'Sci-Fi',
    prompt: 'A vast galaxy of starships, alien civilizations, and advanced technology. Explorers chart unknown systems while interstellar politics simmer.',
  },
  modern: {
    label: 'Modern',
    prompt: 'The modern world, but with a twist -- hidden supernatural forces lurk beneath the surface of everyday life. Those who know the truth must navigate both worlds.',
  },
  horror: {
    label: 'Horror',
    prompt: 'A world where darkness creeps at the edges of reality. Something ancient and terrible has awakened, and ordinary people must face extraordinary terror.',
  },
  historical: {
    label: 'Historical',
    prompt: 'A dramatized historical period where real events mix with adventure. Intrigue, exploration, and the clash of cultures define the era.',
  },
  mashup: {
    label: 'Mashup',
    prompt: 'A wild collision of genres -- maybe cowboys ride dinosaurs in space, or Victorian detectives solve crimes in a cyberpunk city. Anything goes!',
  },
};

export function CreateCampaignForm() {
  const router = useRouter();
  const { playerName, setPlayerName, addCampaign } = useCampaignStore();

  const [isCreating, setIsCreating] = useState(false);
  const [creatingPhase, setCreatingPhase] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSurprising, setIsSurprising] = useState(false);
  const [showWorldBuilder, setShowWorldBuilder] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [friends, setFriends] = useState<Array<{
    playerName: string;
    characterName: string;
    characterConcept: string;
    characterSpecial: string;
  }>>([]);
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

  const handleTemplateSelect = (template: AdventureTemplate) => {
    setFormData((prev) => ({
      ...prev,
      name: template.name,
      worldSetting: template.worldSetting,
      tone: template.tone,
      style: template.style,
      characterConcept: template.characterConcept,
      characterSpecial: template.characterSpecial,
    }));
    setSelectedGenre(null);
    toast.success(`Loaded "${template.title}" template`);
  };

  const handleGenreSelect = (genreKey: string) => {
    const genre = GENRE_STARTERS[genreKey];
    if (!genre) return;
    setSelectedGenre(genreKey);
    setFormData((prev) => ({ ...prev, worldSetting: genre.prompt }));
  };

  const handleSurpriseMe = async () => {
    setIsSurprising(true);
    try {
      const concept = await generateWorldConcept(selectedGenre || undefined);
      setFormData((prev) => ({
        ...prev,
        name: prev.name || concept.name,
        worldSetting: concept.description,
      }));
      toast.success(`Generated: ${concept.name}`);
    } catch (err) {
      console.error('Surprise Me failed:', err);
      toast.error('Failed to generate world concept');
    } finally {
      setIsSurprising(false);
    }
  };

  const handleWorldBuilderComplete = (
    enrichedDescription: string,
    _acceptedEntries: ProposedLoreEntry[]
  ) => {
    setFormData((prev) => ({ ...prev, worldSetting: enrichedDescription }));
    setShowWorldBuilder(false);
    toast.success('World description updated!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.worldSetting.trim() || !formData.playerName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    setCreatingPhase('Creating adventure...');

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

      setPlayerName(formData.playerName.trim());

      const validFriends = friends.filter((f) => f.playerName.trim());
      let allPlayers = [response.player];

      if (validFriends.length > 0) {
        setCreatingPhase(`Generating characters for ${validFriends.length} friend${validFriends.length > 1 ? 's' : ''}...`);
        try {
          const batchResponse = await addLocalPlayersBatch(
            response.campaign.id,
            validFriends.map((f) => ({
              player_name: f.playerName.trim(),
              character_name: f.characterName.trim() || undefined,
              character_class: f.characterConcept.trim() || undefined,
              character_special: f.characterSpecial.trim() || undefined,
            })),
          );
          allPlayers = [response.player, ...batchResponse.players];
        } catch (err) {
          console.error('Failed to add friends:', err);
          toast.error('Friends can be added in the lobby');
        }
      }

      addCampaign({
        campaign: response.campaign,
        players: allPlayers,
        your_player: response.player,
      });

      toast.success('Adventure created!');
      router.push(`/campaigns/${response.campaign.id}`);
    } catch (error: any) {
      console.error('Failed to create campaign:', error);
      toast.error(error.response?.data?.detail || 'Failed to create adventure');
    } finally {
      setIsCreating(false);
      setCreatingPhase('');
    }
  };

  // Show WorldBuilder overlay
  if (showWorldBuilder) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="pt-6">
          <WorldBuilder
            worldDescription={formData.worldSetting}
            tone={formData.tone}
            style={formData.style}
            onComplete={handleWorldBuilderComplete}
            onCancel={() => setShowWorldBuilder(false)}
          />
        </CardContent>
      </Card>
    );
  }

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
          {/* Quick-Start Templates */}
          <div className="space-y-2">
            <Label>Quick Start — Pick a Template</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ADVENTURE_TEMPLATES.map((template) => (
                <button
                  key={template.title}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  disabled={isCreating}
                  className="p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
                >
                  <div className="text-2xl mb-1">{template.emoji}</div>
                  <div className="font-medium text-sm group-hover:text-primary transition-colors">
                    {template.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {template.tagline}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select a template to pre-fill the form, or create your own below.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or build your own</span>
            </div>
          </div>

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

          {/* Genre Quick-Select */}
          <div className="space-y-2">
            <Label>Pick a Genre (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(GENRE_STARTERS).map(([key, genre]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleGenreSelect(key)}
                  disabled={isCreating || isSurprising}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    selectedGenre === key
                      ? 'border-primary bg-primary/10 ring-1 ring-primary font-medium'
                      : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {genre.label}
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSurpriseMe}
                disabled={isCreating || isSurprising}
                className="rounded-full"
              >
                {isSurprising ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Dices className="mr-1 h-3 w-3" />
                    Surprise Me
                  </>
                )}
              </Button>
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                The AI will create a custom game system based on your world description.
              </p>
              {formData.worldSetting.trim().length > 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWorldBuilder(true)}
                  disabled={isCreating}
                >
                  <Wand2 className="mr-1 h-3 w-3" />
                  Expand World
                </Button>
              )}
            </div>
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
                <div className="flex gap-2">
                  <Input
                    id="playerName"
                    placeholder="Your display name"
                    value={formData.playerName}
                    onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                    disabled={isCreating}
                    className="flex-1"
                  />
                  <VoiceInput
                    onTranscript={(text) => setFormData({ ...formData, playerName: text })}
                    disabled={isCreating}
                    continuous={false}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="characterName">Character Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="characterName"
                    placeholder="Thorin, Aria, Luna..."
                    value={formData.characterName}
                    onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
                    disabled={isCreating}
                    className="flex-1"
                  />
                  <VoiceInput
                    onTranscript={(text) => setFormData({ ...formData, characterName: text })}
                    disabled={isCreating}
                    continuous={false}
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="characterConcept">
                  {formData.style === 'narrative' ? 'Who is your character?' : 'Character Class/Role'}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="characterConcept"
                    placeholder={formData.style === 'narrative'
                      ? "A curious young wizard, a brave knight, a clever inventor..."
                      : "Warrior, Mage, Rogue, Healer..."
                    }
                    value={formData.characterConcept}
                    onChange={(e) => setFormData({ ...formData, characterConcept: e.target.value })}
                    disabled={isCreating}
                    className="flex-1"
                  />
                  <VoiceInput
                    onTranscript={(text) => setFormData({ ...formData, characterConcept: text })}
                    disabled={isCreating}
                    continuous={false}
                  />
                </div>
              </div>

              {formData.style === 'narrative' && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="characterSpecial">What makes them special? (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="characterSpecial"
                      placeholder="Can talk to animals, has a magic compass, never gives up..."
                      value={formData.characterSpecial}
                      onChange={(e) => setFormData({ ...formData, characterSpecial: e.target.value })}
                      disabled={isCreating}
                      className="flex-1"
                    />
                    <VoiceInput
                      onTranscript={(text) => setFormData({ ...formData, characterSpecial: text })}
                      disabled={isCreating}
                      continuous={false}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Give your character a unique gift, talent, or trait that makes them memorable!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Party Members */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium">Party Members (optional)</h3>
                <p className="text-xs text-muted-foreground">Add friends who will play with you</p>
              </div>
              {friends.length < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFriends([...friends, { playerName: '', characterName: '', characterConcept: '', characterSpecial: '' }])}
                  disabled={isCreating}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add a Friend
                </Button>
              )}
            </div>

            {friends.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                You can add friends now or later in the lobby.
              </p>
            )}

            <div className="space-y-3">
              {friends.map((friend, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border space-y-3 relative">
                  <button
                    type="button"
                    onClick={() => setFriends(friends.filter((_, i) => i !== idx))}
                    disabled={isCreating}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="text-xs font-medium text-muted-foreground">Friend {idx + 1}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Player Name *</Label>
                      <Input
                        placeholder="Friend's name"
                        value={friend.playerName}
                        onChange={(e) => {
                          const updated = [...friends];
                          updated[idx] = { ...updated[idx], playerName: e.target.value };
                          setFriends(updated);
                        }}
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Character Name</Label>
                      <Input
                        placeholder="Thorin, Aria, Luna..."
                        value={friend.characterName}
                        onChange={(e) => {
                          const updated = [...friends];
                          updated[idx] = { ...updated[idx], characterName: e.target.value };
                          setFriends(updated);
                        }}
                        disabled={isCreating}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">
                        {formData.style === 'narrative' ? 'Who is their character?' : 'Character Class/Role'}
                      </Label>
                      <Input
                        placeholder={formData.style === 'narrative'
                          ? "A brave knight, a clever inventor..."
                          : "Warrior, Mage, Rogue..."
                        }
                        value={friend.characterConcept}
                        onChange={(e) => {
                          const updated = [...friends];
                          updated[idx] = { ...updated[idx], characterConcept: e.target.value };
                          setFriends(updated);
                        }}
                        disabled={isCreating}
                      />
                    </div>
                    {formData.style === 'narrative' && (
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">What makes them special?</Label>
                        <Input
                          placeholder="Can talk to animals, has a magic compass..."
                          value={friend.characterSpecial}
                          onChange={(e) => {
                            const updated = [...friends];
                            updated[idx] = { ...updated[idx], characterSpecial: e.target.value };
                            setFriends(updated);
                          }}
                          disabled={isCreating}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
                  {creatingPhase || 'Creating Adventure...'}
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
