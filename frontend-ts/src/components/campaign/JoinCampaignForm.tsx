'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { joinCampaign } from '@/lib/api';
import { useCampaignStore } from '@/stores/campaignStore';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function JoinCampaignForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { playerName, setPlayerName, addCampaign } = useCampaignStore();
  const tToast = useTranslations('toast');
  const t = useTranslations('campaign.join');

  const [isJoining, setIsJoining] = useState(false);
  const [formData, setFormData] = useState({
    inviteCode: searchParams.get('code') || '',
    playerName: playerName || '',
    characterName: '',
    characterClass: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.inviteCode.trim() || !formData.playerName.trim()) {
      toast.error(tToast('enterCodeAndName'));
      return;
    }

    setIsJoining(true);

    try {
      const response = await joinCampaign({
        invite_code: formData.inviteCode.trim().toUpperCase(),
        player_name: formData.playerName.trim(),
        character_name: formData.characterName.trim() || undefined,
        character_class: formData.characterClass.trim() || undefined,
      });

      // Save player name for future use
      setPlayerName(formData.playerName.trim());

      // Add to campaigns list
      addCampaign({
        campaign: response.campaign,
        players: [], // Will be loaded when entering the campaign
        your_player: response.player,
      });

      toast.success(tToast('joinedAdventure', { adventureName: response.campaign.name }));
      router.push(`/campaigns/${response.campaign.id}`);
    } catch (error: any) {
      console.error('Failed to join campaign:', error);
      toast.error(error.response?.data?.detail || tToast('joinFailed'));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-500" />
          {t('title')}
        </CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">{t('inviteCodeLabel')} *</Label>
            <Input
              id="inviteCode"
              placeholder={t('inviteCodePlaceholder')}
              value={formData.inviteCode}
              onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
              disabled={isJoining}
              className="text-center text-lg font-mono tracking-widest uppercase"
              maxLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="playerName">{t('yourNameLabel')} *</Label>
            <Input
              id="playerName"
              placeholder={t('yourNamePlaceholder')}
              value={formData.playerName}
              onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
              disabled={isJoining}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="characterName">{t('characterNameLabel')}</Label>
            <Input
              id="characterName"
              placeholder={t('characterNamePlaceholder')}
              value={formData.characterName}
              onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
              disabled={isJoining}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="characterClass">{t('characterClassLabel')}</Label>
            <Input
              id="characterClass"
              placeholder={t('characterClassPlaceholder')}
              value={formData.characterClass}
              onChange={(e) => setFormData({ ...formData, characterClass: e.target.value })}
              disabled={isJoining}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/')}
              disabled={isJoining}
            >
              {t('cancelButton')}
            </Button>
            <Button type="submit" disabled={isJoining} className="flex-1">
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('joiningButton')}
                </>
              ) : (
                t('joinButton')
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
