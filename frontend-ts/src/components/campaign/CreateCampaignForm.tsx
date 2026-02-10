'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Users, BookOpen, Swords, Wand2, Dices, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VoiceInput } from '@/components/ui/voice-input';
import { createCampaign, generateWorldConcept, addLocalPlayersBatch } from '@/lib/api';
import { useCampaignStore } from '@/stores/campaignStore';
import { WorldBuilder } from './WorldBuilder';
import { TemplateSelector } from './TemplateSelector';
import { toast } from 'sonner';
import type { ProposedLoreEntry } from '@/lib/types';
import type { Locale } from '@/hooks/useActiveLocale';
import { useActiveLocale } from '@/hooks/useActiveLocale';

// Default to OpenAI model for voice-enabled campaigns (better for multimodal)
const DEFAULT_VOICE_MODEL = 'openai/gpt-4o';

type GameTone = 'family_friendly' | 'all_ages' | 'mature';
type GameStyle = 'narrative' | 'mechanical' | 'hybrid';

// Map backend values (snake_case) to translation keys (camelCase)
const TONE_TRANSLATION_KEYS = {
  family_friendly: 'familyFriendly',
  all_ages: 'allAges',
  mature: 'mature'
} as const;

const TEMPLATES = [
  { key: 'dragonsPeak', emoji: '🐉', tone: 'all_ages' as GameTone, style: 'narrative' as GameStyle },
  { key: 'starWanderers', emoji: '🚀', tone: 'mature' as GameTone, style: 'hybrid' as GameStyle },
  { key: 'enchantedAcademy', emoji: '✨', tone: 'family_friendly' as GameTone, style: 'narrative' as GameStyle },
];

const GENRE_KEYS = ['fantasy', 'scifi', 'modern', 'horror', 'historical', 'mashup'] as const;

export function CreateCampaignForm() {
  const router = useRouter();
  const { playerName, setPlayerName, addCampaign } = useCampaignStore();
  const currentLocale = useActiveLocale();
  const t = useTranslations('campaign.create');
  const tToast = useTranslations('toast');
  const tGenres = useTranslations('campaign.create.genres');
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

  const handleTemplateSelect = (templateKey: string, template: {
    name: string;
    world: string;
    characterConcept: string;
    characterSpecial: string;
    tone: GameTone;
    style: GameStyle;
  }) => {
    setFormData((prev) => ({
      ...prev,
      name: template.name,
      worldSetting: template.world,
      tone: template.tone,
      style: template.style,
      characterConcept: template.characterConcept,
      characterSpecial: template.characterSpecial,
    }));
    setSelectedGenre(null);
    const templateTitle = t(`templates.${templateKey}.title`);
    toast.success(tToast('templateLoaded', { title: templateTitle }));
  };

  const handleTemplateSelectorClick = (templateKey: string) => {
    const template = TEMPLATES.find(t => t.key === templateKey);
    if (!template) return;

    handleTemplateSelect(templateKey, {
      name: t(`templates.${templateKey}.name`),
      world: t(`templates.${templateKey}.world`),
      characterConcept: t(`templates.${templateKey}.characterConcept`),
      characterSpecial: t(`templates.${templateKey}.characterSpecial`),
      tone: template.tone,
      style: template.style,
    });
  };

  const handleGenreSelect = (genreKey: string) => {
    const prompt = t(`genrePrompts.${genreKey}`);
    if (!prompt) return;
    setSelectedGenre(genreKey);
    setFormData((prev) => ({ ...prev, worldSetting: prompt }));
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
      toast.success(tToast('worldGenerated', { name: concept.name }));
    } catch (err) {
      console.error('Surprise Me failed:', err);
      toast.error(tToast('worldGenerateFailed'));
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
    toast.success(tToast('worldUpdated'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.worldSetting.trim() || !formData.playerName.trim()) {
      toast.error(tToast('fillRequired'));
      return;
    }

    setIsCreating(true);
    setCreatingPhase(t('creating'));

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
        language: currentLocale,
      });

      setPlayerName(formData.playerName.trim());

      const validFriends = friends.filter((f) => f.playerName.trim());
      let allPlayers = [response.player];

      if (validFriends.length > 0) {
        const plural = validFriends.length > 1 ? 's' : '';
        setCreatingPhase(t('generatingCharacters', { count: validFriends.length, plural }));
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
          toast.error(tToast('friendsAddLater'));
        }
      }

      addCampaign({
        campaign: response.campaign,
        players: allPlayers,
        your_player: response.player,
      });

      toast.success(tToast('adventureCreated'));
      router.push(`/campaigns/${response.campaign.id}`);
    } catch (error: any) {
      console.error('Failed to create campaign:', error);
      toast.error(error.response?.data?.detail || tToast('campaignCreateFailed'));
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
          {t('title')}
        </CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quick-Start Templates */}
          <div className="space-y-2">
            <TemplateSelector
              onSelect={handleTemplateSelectorClick}
              selectedName={formData.name}
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              {t('templateHint')}
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('orBuildOwn')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">{t('adventureName')} *</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                placeholder={t('adventureNamePlaceholder')}
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
            <Label>{t('pickGenre')}</Label>
            <div className="flex flex-wrap gap-2">
              {GENRE_KEYS.map((key) => (
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
                  {tGenres(key)}
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
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Dices className="mr-1 h-3 w-3" />
                    {t('surpriseMe')}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="worldSetting">{t('worldSetting')} *</Label>
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
                  {isRecording ? t('listening') : t('orUseVoice')}
                </span>
              </div>
            </div>
            <Textarea
              id="worldSetting"
              placeholder={t('worldSettingPlaceholder')}
              className="min-h-[150px]"
              value={formData.worldSetting}
              onChange={(e) => setFormData({ ...formData, worldSetting: e.target.value })}
              disabled={isCreating}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t('worldSettingHint')}
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
                  {t('expandWorld')}
                </Button>
              )}
            </div>
          </div>

          {/* Game Style Options */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-4">{t('adventureStyle')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Tone Selection */}
              <div className="space-y-2">
                <Label>{t('toneLabel')}</Label>
                <div className="grid grid-cols-1 gap-2">
                  {(['family_friendly', 'all_ages', 'mature'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData({ ...formData, tone: value })}
                      disabled={isCreating}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        formData.tone === value
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{t(`tones.${TONE_TRANSLATION_KEYS[value]}.label`)}</div>
                      <div className="text-xs text-muted-foreground">{t(`tones.${TONE_TRANSLATION_KEYS[value]}.description`)}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Selection */}
              <div className="space-y-2">
                <Label>{t('styleLabel')}</Label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'narrative' as const, icon: BookOpen },
                    { value: 'hybrid' as const, icon: Users },
                    { value: 'mechanical' as const, icon: Swords },
                  ].map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData({ ...formData, style: value })}
                      disabled={isCreating}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        formData.style === value
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {t(`styles.${value}.label`)}
                      </div>
                      <div className="text-xs text-muted-foreground">{t(`styles.${value}.description`)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Character Creation */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-4">{t('yourCharacter')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="playerName">{t('yourName')} *</Label>
                <div className="flex gap-2">
                  <Input
                    id="playerName"
                    placeholder={t('yourNamePlaceholder')}
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
                <Label htmlFor="characterName">{t('characterName')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="characterName"
                    placeholder={t('characterNamePlaceholder')}
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
                  {formData.style === 'narrative' ? t('characterConcept') : t('characterClass')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="characterConcept"
                    placeholder={formData.style === 'narrative'
                      ? t('characterConceptPlaceholder')
                      : t('characterClassPlaceholder')
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
                  <Label htmlFor="characterSpecial">{t('characterSpecial')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="characterSpecial"
                      placeholder={t('characterSpecialPlaceholder')}
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
                    {t('characterSpecialHint')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Party Members */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium">{t('partyMembers')}</h3>
                <p className="text-xs text-muted-foreground">{t('partyMembersHint')}</p>
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
                  {t('addFriend')}
                </Button>
              )}
            </div>

            {friends.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                {t('addLaterHint')}
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
                  <div className="text-xs font-medium text-muted-foreground">{t('friendNumber', { number: idx + 1 })}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('friendPlayerName')} *</Label>
                      <Input
                        placeholder={t('friendPlayerNamePlaceholder')}
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
                      <Label className="text-xs">{t('friendCharacterName')}</Label>
                      <Input
                        placeholder={t('characterNamePlaceholder')}
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
                        {formData.style === 'narrative' ? t('friendCharacterConcept') : t('friendCharacterClass')}
                      </Label>
                      <Input
                        placeholder={formData.style === 'narrative'
                          ? t('friendCharacterConceptPlaceholder')
                          : t('friendCharacterClassPlaceholder')
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
                        <Label className="text-xs">{t('friendCharacterSpecial')}</Label>
                        <Input
                          placeholder={t('friendCharacterSpecialPlaceholder')}
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
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isCreating} className="flex-1">
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {creatingPhase || t('creating')}
                </>
              ) : (
                t('createButton')
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
