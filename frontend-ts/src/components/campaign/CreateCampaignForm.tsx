'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Users, BookOpen, Swords, Wand2, UserPlus, RefreshCw, Play, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VoiceInput } from '@/components/ui/voice-input';
import { createCampaign, addLocalPlayersBatch, generateSimpleAttributes } from '@/lib/api';
import { useCampaignStore } from '@/stores/campaignStore';
import { WorldBuilder } from './WorldBuilder';
import { TemplateSelector } from './TemplateSelector';
import { CharacterFormFields, type CharacterFormData } from '@/components/shared/CharacterFormFields';
import { AttributeAllocator, getValuePool } from '@/components/shared/AttributeAllocator';
import { toast } from 'sonner';
import type { ProposedLoreEntry, SimpleAttribute } from '@/lib/types';
import { useActiveLocale } from '@/hooks/useActiveLocale';

const DEFAULT_VOICE_MODEL = 'openai/gpt-4o';

type GameTone = 'family_friendly' | 'all_ages' | 'mature';
type GameStyle = 'narrative' | 'mechanical' | 'hybrid';

const TONE_TRANSLATION_KEYS = {
  family_friendly: 'familyFriendly',
  all_ages: 'allAges',
  mature: 'mature',
} as const;

const TEMPLATES = [
  { key: 'dragonsPeak', emoji: '🐉', tone: 'all_ages' as GameTone, style: 'narrative' as GameStyle },
  { key: 'starWanderers', emoji: '🚀', tone: 'mature' as GameTone, style: 'hybrid' as GameStyle },
  { key: 'enchantedAcademy', emoji: '✨', tone: 'family_friendly' as GameTone, style: 'narrative' as GameStyle },
];

interface FormPlayer {
  playerName: string;
  characterName: string;
  characterConcept: string;
  characterSpecial: string;
  attributeScores: Record<string, number>;
}

export function CreateCampaignForm() {
  const router = useRouter();
  const { playerName: storedPlayerName, setPlayerName, addCampaign } = useCampaignStore();
  const currentLocale = useActiveLocale();
  const t = useTranslations('campaign.create');
  const tToast = useTranslations('toast');

  const attributesRef = useRef<HTMLDivElement>(null);

  // Adventure details
  const [adventureData, setAdventureData] = useState({
    name: '',
    worldSetting: '',
    tone: 'all_ages' as GameTone,
    style: 'narrative' as GameStyle,
  });

  // Generated attributes
  const [generatedAttributes, setGeneratedAttributes] = useState<SimpleAttribute[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Player management
  const [addedPlayers, setAddedPlayers] = useState<FormPlayer[]>([]);
  const [playerForm, setPlayerForm] = useState<CharacterFormData>({
    playerName: storedPlayerName || '',
    characterName: '',
    characterConcept: '',
    characterSpecial: '',
  });
  const [attributeScores, setAttributeScores] = useState<Record<string, number>>({});

  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [creatingPhase, setCreatingPhase] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showWorldBuilder, setShowWorldBuilder] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const availableValues = getValuePool(
    generatedAttributes.length,
    adventureData.style === 'hybrid' ? 'narrative' : adventureData.style,
  );

  // --- Handlers ---

  const handleTemplateSelectorClick = (templateKey: string) => {
    const templateDef = TEMPLATES.find((td) => td.key === templateKey);
    if (!templateDef) return;

    setAdventureData((prev) => ({
      ...prev,
      name: t(`templates.${templateKey}.name`),
      worldSetting: t(`templates.${templateKey}.world`),
      tone: templateDef.tone,
      style: templateDef.style,
    }));
    toast.success(tToast('templateLoaded', { title: t(`templates.${templateKey}.title`) }));
  };

  const handleWorldBuilderComplete = (
    enrichedDescription: string,
    _acceptedEntries: ProposedLoreEntry[],
  ) => {
    setAdventureData((prev) => ({ ...prev, worldSetting: enrichedDescription }));
    setShowWorldBuilder(false);
    toast.success(tToast('worldUpdated'));
  };

  const handleCreateAdventure = async () => {
    if (!adventureData.name.trim() || !adventureData.worldSetting.trim()) {
      toast.error(tToast('fillRequired'));
      return;
    }

    setIsGenerating(true);
    try {
      const response = await generateSimpleAttributes(
        adventureData.worldSetting.trim(),
        currentLocale,
        DEFAULT_VOICE_MODEL,
      );
      setGeneratedAttributes(response.attributes);
      setAddedPlayers([]);
      setAttributeScores({});
      // Scroll to attributes after render
      setTimeout(() => attributesRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to generate attributes:', err);
      toast.error(tToast('campaignCreateFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateAttributes = async () => {
    setIsGenerating(true);
    try {
      const response = await generateSimpleAttributes(
        adventureData.worldSetting.trim(),
        currentLocale,
        DEFAULT_VOICE_MODEL,
      );
      setGeneratedAttributes(response.attributes);
      setAddedPlayers([]);
      setAttributeScores({});
      setTimeout(() => attributesRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to regenerate attributes:', err);
      toast.error(tToast('campaignCreateFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();

    if (!playerForm.playerName.trim()) {
      setPlayerError(tToast('playerNameRequired'));
      return;
    }
    if (!playerForm.characterName.trim()) {
      setPlayerError(tToast('playerNameRequired'));
      return;
    }

    const scores = Object.values(attributeScores);
    if (scores.length !== generatedAttributes.length) {
      setPlayerError(tToast('playerNameRequired'));
      return;
    }

    setAddedPlayers((prev) => [
      ...prev,
      {
        playerName: playerForm.playerName.trim(),
        characterName: playerForm.characterName.trim(),
        characterConcept: playerForm.characterConcept.trim(),
        characterSpecial: playerForm.characterSpecial.trim(),
        attributeScores: { ...attributeScores },
      },
    ]);

    setPlayerForm({
      playerName: '',
      characterName: '',
      characterConcept: '',
      characterSpecial: '',
    });
    setAttributeScores({});
    setPlayerError(null);
  };

  const handleRemovePlayer = (index: number) => {
    setAddedPlayers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartAdventure = async () => {
    if (addedPlayers.length === 0) {
      toast.error(t('needOnePlayer'));
      return;
    }

    setIsCreating(true);
    setCreatingPhase(t('creating'));

    try {
      const firstPlayer = addedPlayers[0];

      const response = await createCampaign({
        name: adventureData.name.trim(),
        world_setting: adventureData.worldSetting.trim(),
        player_name: firstPlayer.playerName,
        character_name: firstPlayer.characterName || undefined,
        character_class: firstPlayer.characterConcept || undefined,
        character_special: firstPlayer.characterSpecial || undefined,
        attribute_scores:
          Object.keys(firstPlayer.attributeScores).length > 0 ? firstPlayer.attributeScores : undefined,
        attribute_details: generatedAttributes.length > 0 ? generatedAttributes : undefined,
        model: DEFAULT_VOICE_MODEL,
        tone: adventureData.tone,
        style: adventureData.style,
        language: currentLocale,
      });

      setPlayerName(firstPlayer.playerName);

      const remainingPlayers = addedPlayers.slice(1);
      let allPlayers = [response.player];

      if (remainingPlayers.length > 0) {
        const plural = remainingPlayers.length > 1 ? 's' : '';
        setCreatingPhase(t('generatingCharacters', { count: remainingPlayers.length, plural }));
        try {
          const batchResponse = await addLocalPlayersBatch(
            response.campaign.id,
            remainingPlayers.map((p) => ({
              player_name: p.playerName,
              character_name: p.characterName || undefined,
              character_class: p.characterConcept || undefined,
              character_special: p.characterSpecial || undefined,
              attribute_scores:
                Object.keys(p.attributeScores).length > 0 ? p.attributeScores : undefined,
            })),
          );
          allPlayers = [response.player, ...batchResponse.players];
        } catch (err) {
          console.error('Failed to add players:', err);
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

  // --- WorldBuilder overlay ---

  if (showWorldBuilder) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="pt-6">
          <WorldBuilder
            worldDescription={adventureData.worldSetting}
            tone={adventureData.tone}
            style={adventureData.style}
            onComplete={handleWorldBuilderComplete}
            onCancel={() => setShowWorldBuilder(false)}
          />
        </CardContent>
      </Card>
    );
  }

  // --- Render ---

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Templates */}
          <div className="space-y-2">
            <TemplateSelector
              onSelect={handleTemplateSelectorClick}
              selectedName={adventureData.name}
              disabled={isGenerating || generatedAttributes.length > 0}
            />
            <p className="text-xs text-muted-foreground">{t('templateHint')}</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('orBuildOwn')}</span>
            </div>
          </div>

          {/* Adventure Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('adventureName')} *</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                placeholder={t('adventureNamePlaceholder')}
                value={adventureData.name}
                onChange={(e) => setAdventureData({ ...adventureData, name: e.target.value })}
                disabled={isGenerating || generatedAttributes.length > 0}
                className="flex-1"
              />
              <VoiceInput
                onTranscript={(text) => setAdventureData({ ...adventureData, name: text })}
                disabled={isGenerating || generatedAttributes.length > 0}
                continuous={false}
              />
            </div>
          </div>

          {/* World Setting */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="worldSetting">{t('worldSetting')} *</Label>
              <div className="flex items-center gap-2">
                <VoiceInput
                  onTranscript={(text) => {
                    setAdventureData({ ...adventureData, worldSetting: text });
                    setIsRecording(false);
                  }}
                  onPartialTranscript={(text) => {
                    setAdventureData({ ...adventureData, worldSetting: text });
                    setIsRecording(true);
                  }}
                  disabled={isGenerating || generatedAttributes.length > 0}
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
              value={adventureData.worldSetting}
              onChange={(e) => setAdventureData({ ...adventureData, worldSetting: e.target.value })}
              disabled={isGenerating || generatedAttributes.length > 0}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{t('worldSettingHint')}</p>
              {adventureData.worldSetting.trim().length > 10 && !generatedAttributes.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWorldBuilder(true)}
                  disabled={isGenerating}
                >
                  <Wand2 className="mr-1 h-3 w-3" />
                  {t('expandWorld')}
                </Button>
              )}
            </div>
          </div>

          {/* Tone & Style */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-4">{t('adventureStyle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('toneLabel')}</Label>
                <div className="grid grid-cols-1 gap-2">
                  {(['family_friendly', 'all_ages', 'mature'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAdventureData({ ...adventureData, tone: value })}
                      disabled={isGenerating || generatedAttributes.length > 0}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        adventureData.tone === value
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {t(`tones.${TONE_TRANSLATION_KEYS[value]}.label`)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t(`tones.${TONE_TRANSLATION_KEYS[value]}.description`)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

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
                      onClick={() => setAdventureData({ ...adventureData, style: value })}
                      disabled={isGenerating || generatedAttributes.length > 0}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        adventureData.style === value
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {t(`styles.${value}.label`)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t(`styles.${value}.description`)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Create Adventure Button */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => router.push('/')} disabled={isGenerating || isCreating}>
              {t('cancel')}
            </Button>
            <Button
              onClick={generatedAttributes.length > 0 ? handleRegenerateAttributes : handleCreateAdventure}
              disabled={isGenerating || !adventureData.name.trim() || !adventureData.worldSetting.trim()}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('creating')}
                </>
              ) : generatedAttributes.length > 0 ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('regenerateAttributes')}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('createButton')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== PLAYERS SECTION (appears after attributes generated) ===== */}
      {generatedAttributes.length > 0 && (
        <>
          {/* Generated Attributes */}
          <Card ref={attributesRef}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t('characterAttributes')}</CardTitle>
              <CardDescription>{t('attributesGenerated')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                {generatedAttributes.map((attr) => (
                  <div key={attr.name} className="p-3 rounded-lg border bg-card">
                    <div className="font-medium">{attr.name}</div>
                    <div className="text-sm text-muted-foreground">{attr.description}</div>
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={handleRegenerateAttributes} disabled={isGenerating} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                {t('regenerateAttributes')}
              </Button>
            </CardContent>
          </Card>

          {/* Added Players */}
          {addedPlayers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {t('partyMembers')} ({addedPlayers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {addedPlayers.map((player, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{player.characterName || player.playerName}</div>
                        {player.characterConcept && (
                          <div className="text-sm text-muted-foreground">{player.characterConcept}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {t('playedBy', { playerName: player.playerName })}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(player.attributeScores).map(([name, score]) => (
                            <Badge key={name} variant="secondary" className="text-xs font-mono">
                              {name}: {score >= 0 ? '+' : ''}
                              {score}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemovePlayer(idx)} className="ml-2 shrink-0">
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Player Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                {t('addPlayer')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPlayer} className="space-y-4">
                <CharacterFormFields
                  formData={playerForm}
                  onChange={(field, value) => setPlayerForm((prev) => ({ ...prev, [field]: value }))}
                  disabled={false}
                  gameStyle={adventureData.style === 'hybrid' ? 'narrative' : adventureData.style}
                  translationNamespace="shared.characterForm"
                  showVoiceInput={false}
                  showSpecialTrait={true}
                />

                <div className="space-y-2">
                  <Label>{t('attributeScores')}</Label>
                  <AttributeAllocator
                    attributes={generatedAttributes}
                    availableValues={availableValues}
                    currentScores={attributeScores}
                    onChange={setAttributeScores}
                    displayMode={adventureData.style === 'mechanical' ? 'value' : 'modifier'}
                  />
                </div>

                {playerError && <p className="text-sm text-red-500">{playerError}</p>}

                <Button type="submit" className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('addPlayerButton')}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Start Adventure */}
          <div className="flex gap-3">
            <Button
              onClick={handleStartAdventure}
              disabled={isCreating || addedPlayers.length === 0}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {creatingPhase || t('creating')}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {t('startAdventure')}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
