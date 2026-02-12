'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VoiceInput } from '@/components/ui/voice-input';
import { useTranslations } from 'next-intl';

export interface CharacterFormData {
  playerName: string;
  characterName: string;
  characterConcept: string;
  characterSpecial: string;
}

export interface CharacterFormFieldsProps {
  /** Current form values */
  formData: CharacterFormData;
  /** Callback when any field changes */
  onChange: (field: keyof CharacterFormData, value: string) => void;
  /** Whether fields are disabled (e.g., during submission) */
  disabled?: boolean;
  /** Game style affects labels and which fields are shown */
  gameStyle?: 'narrative' | 'mechanical' | 'simple';
  /** Translation namespace to use */
  translationNamespace?: string;
  /** Whether to show voice input buttons */
  showVoiceInput?: boolean;
  /** Whether to show the special trait field */
  showSpecialTrait?: boolean;
  /** Custom placeholder overrides */
  placeholders?: Partial<Record<keyof CharacterFormData, string>>;
}

/**
 * Shared component for character/player creation form fields.
 * Used across simple-rpg PlayerSetup, campaign AddPlayerForm, and CreateCampaignForm.
 *
 * Provides consistent UX for:
 * - Player Name (real person)
 * - Character Name (in-game)
 * - Character Concept/Class
 * - Character Special Trait (optional, for narrative games)
 */
export function CharacterFormFields({
  formData,
  onChange,
  disabled = false,
  gameStyle = 'narrative',
  translationNamespace = 'shared.characterForm',
  showVoiceInput = false,
  showSpecialTrait = true,
  placeholders,
}: CharacterFormFieldsProps) {
  const t = useTranslations(translationNamespace);

  // Determine labels based on game style
  const conceptLabel = gameStyle === 'narrative'
    ? t('characterConcept')
    : t('characterClass');

  const conceptPlaceholder = placeholders?.characterConcept || (
    gameStyle === 'narrative'
      ? t('characterConceptPlaceholder')
      : t('characterClassPlaceholder')
  );

  const shouldShowSpecial = showSpecialTrait && gameStyle === 'narrative';

  return (
    <div className="space-y-4">
      {/* Player Name */}
      <div className="space-y-2">
        <Label htmlFor="player-name">{t('playerName')}</Label>
        <div className="flex gap-2">
          <Input
            id="player-name"
            placeholder={placeholders?.playerName || t('playerNamePlaceholder')}
            value={formData.playerName}
            onChange={(e) => onChange('playerName', e.target.value)}
            disabled={disabled}
            className="flex-1"
          />
          {showVoiceInput && (
            <VoiceInput
              onTranscript={(text) => onChange('playerName', text)}
              disabled={disabled}
              continuous={false}
            />
          )}
        </div>
      </div>

      {/* Character Name */}
      <div className="space-y-2">
        <Label htmlFor="character-name">{t('characterName')}</Label>
        <div className="flex gap-2">
          <Input
            id="character-name"
            placeholder={placeholders?.characterName || t('characterNamePlaceholder')}
            value={formData.characterName}
            onChange={(e) => onChange('characterName', e.target.value)}
            disabled={disabled}
            className="flex-1"
          />
          {showVoiceInput && (
            <VoiceInput
              onTranscript={(text) => onChange('characterName', text)}
              disabled={disabled}
              continuous={false}
            />
          )}
        </div>
      </div>

      {/* Character Concept/Class */}
      <div className="space-y-2">
        <Label htmlFor="character-concept">{conceptLabel}</Label>
        <div className="flex gap-2">
          <Input
            id="character-concept"
            placeholder={conceptPlaceholder}
            value={formData.characterConcept}
            onChange={(e) => onChange('characterConcept', e.target.value)}
            disabled={disabled}
            className="flex-1"
          />
          {showVoiceInput && (
            <VoiceInput
              onTranscript={(text) => onChange('characterConcept', text)}
              disabled={disabled}
              continuous={false}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('characterConceptHint')}
        </p>
      </div>

      {/* Character Special Trait (narrative mode only) */}
      {shouldShowSpecial && (
        <div className="space-y-2">
          <Label htmlFor="character-special">{t('characterSpecial')}</Label>
          <div className="flex gap-2">
            <Input
              id="character-special"
              placeholder={placeholders?.characterSpecial || t('characterSpecialPlaceholder')}
              value={formData.characterSpecial}
              onChange={(e) => onChange('characterSpecial', e.target.value)}
              disabled={disabled}
              className="flex-1"
            />
            {showVoiceInput && (
              <VoiceInput
                onTranscript={(text) => onChange('characterSpecial', text)}
                disabled={disabled}
                continuous={false}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('characterSpecialHint')}
          </p>
        </div>
      )}
    </div>
  );
}
