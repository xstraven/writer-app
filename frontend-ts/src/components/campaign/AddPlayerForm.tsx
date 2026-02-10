'use client';

import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  const [formData, setFormData] = useState({
    playerName: '',
    characterName: '',
    characterClass: '',
    characterSpecial: '',
  });

  const isNarrative = gameStyle === 'narrative';

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
        character_class: formData.characterClass.trim() || undefined,
        character_special: formData.characterSpecial.trim() || undefined,
      });

      toast.success(tToast('playerJoinedParty', { playerName: response.player.character_sheet?.name || formData.playerName }));
      onPlayerAdded(response.player);

      setFormData({ playerName: '', characterName: '', characterClass: '', characterSpecial: '' });
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
          <div className="space-y-2">
            <Label htmlFor="playerName">{t('playerNameLabel')}</Label>
            <Input
              id="playerName"
              placeholder={t('playerNamePlaceholder')}
              value={formData.playerName}
              onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
              disabled={isAdding}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="characterName">{t('characterNameLabel')}</Label>
            <Input
              id="characterName"
              placeholder={t('characterNamePlaceholder')}
              value={formData.characterName}
              onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
              disabled={isAdding}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="characterClass">
              {isNarrative ? t('characterClassNarrativeLabel') : t('characterClassMechanicalLabel')}
            </Label>
            <Input
              id="characterClass"
              placeholder={isNarrative
                ? t('characterClassNarrativePlaceholder')
                : t('characterClassMechanicalPlaceholder')
              }
              value={formData.characterClass}
              onChange={(e) => setFormData({ ...formData, characterClass: e.target.value })}
              disabled={isAdding}
            />
            <p className="text-xs text-muted-foreground">
              {t('characterClassHint')}
            </p>
          </div>

          {isNarrative && (
            <div className="space-y-2">
              <Label htmlFor="characterSpecial">{t('characterSpecialLabel')}</Label>
              <Input
                id="characterSpecial"
                placeholder={t('characterSpecialPlaceholder')}
                value={formData.characterSpecial}
                onChange={(e) => setFormData({ ...formData, characterSpecial: e.target.value })}
                disabled={isAdding}
              />
            </div>
          )}

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
