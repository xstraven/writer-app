'use client';

import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CharacterFormFields, type CharacterFormData } from '@/components/shared/CharacterFormFields';
import { addLocalPlayer } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Player } from '@/lib/types';

interface AddPlayerFormProps {
  campaignId: string;
  onPlayerAdded: (player: Player) => void;
  gameStyle?: 'narrative' | 'mechanical' | 'hybrid';
  trigger?: React.ReactNode;
}

export function AddPlayerForm({ campaignId, onPlayerAdded, gameStyle, trigger }: AddPlayerFormProps) {
  const tToast = useTranslations('toast');
  const t = useTranslations('campaign.addPlayer');
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<CharacterFormData>({
    playerName: '',
    characterName: '',
    characterConcept: '',
    characterSpecial: '',
  });

  const isNarrative = gameStyle === 'narrative';

  const handleFieldChange = (field: keyof CharacterFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.playerName.trim()) {
      toast.error(tToast('playerNameRequired'));
      return;
    }

    setIsAdding(true);

    try {
      const response = await addLocalPlayer(campaignId, {
        player_name: formData.playerName.trim(),
        character_name: formData.characterName.trim() || undefined,
        character_class: formData.characterConcept.trim() || undefined,
        character_special: formData.characterSpecial.trim() || undefined,
      });

      toast.success(tToast('playerJoinedParty', { playerName: response.player.character_sheet?.name || formData.playerName }));
      onPlayerAdded(response.player);

      setFormData({ playerName: '', characterName: '', characterConcept: '', characterSpecial: '' });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Failed to add player:', error);
      toast.error(error.response?.data?.detail || tToast('addPlayerFailed'));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-1" />
            {t('trigger')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <CharacterFormFields
            formData={formData}
            onChange={handleFieldChange}
            disabled={isAdding}
            gameStyle={gameStyle === 'hybrid' ? 'narrative' : gameStyle}
            translationNamespace="shared.characterForm"
            showVoiceInput={false}
            showSpecialTrait={true}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isAdding}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isAdding} className="flex-1">
              {isAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('adding')}
                </>
              ) : (
                t('addButton')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
