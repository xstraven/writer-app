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

export function JoinCampaignForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { playerName, setPlayerName, addCampaign } = useCampaignStore();

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
      toast.error('Please enter an invite code and your name');
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

      toast.success(`Joined "${response.campaign.name}"!`);
      router.push(`/campaigns/${response.campaign.id}`);
    } catch (error: any) {
      console.error('Failed to join campaign:', error);
      toast.error(error.response?.data?.detail || 'Failed to join adventure');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-500" />
          Join Adventure
        </CardTitle>
        <CardDescription>
          Enter the invite code shared by the adventure creator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invite Code *</Label>
            <Input
              id="inviteCode"
              placeholder="ABC123"
              value={formData.inviteCode}
              onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
              disabled={isJoining}
              className="text-center text-lg font-mono tracking-widest uppercase"
              maxLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="playerName">Your Name *</Label>
            <Input
              id="playerName"
              placeholder="Your display name"
              value={formData.playerName}
              onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
              disabled={isJoining}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="characterName">Character Name</Label>
            <Input
              id="characterName"
              placeholder="Thorin, Aria, etc."
              value={formData.characterName}
              onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
              disabled={isJoining}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="characterClass">Character Class/Role</Label>
            <Input
              id="characterClass"
              placeholder="Warrior, Mage, Rogue..."
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
              Cancel
            </Button>
            <Button type="submit" disabled={isJoining} className="flex-1">
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Adventure'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
