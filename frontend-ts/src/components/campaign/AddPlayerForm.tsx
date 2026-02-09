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
import type { Player } from '@/lib/types';

interface AddPlayerFormProps {
  campaignId: string;
  onPlayerAdded: (player: Player) => void;
  gameStyle?: 'narrative' | 'mechanical' | 'hybrid';
  trigger?: React.ReactNode;
}

export function AddPlayerForm({ campaignId, onPlayerAdded, gameStyle, trigger }: AddPlayerFormProps) {
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
      toast.error('Player name is required');
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

      toast.success(`${response.player.character_sheet?.name || formData.playerName} joined the party!`);
      onPlayerAdded(response.player);

      setFormData({ playerName: '', characterName: '', characterClass: '', characterSpecial: '' });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Failed to add player:', error);
      toast.error(error.response?.data?.detail || 'Failed to add player');
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
            Add Player
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Another Player</DialogTitle>
          <DialogDescription>
            Add a friend to join the adventure. The AI will generate their character.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playerName">Player Name *</Label>
            <Input
              id="playerName"
              placeholder="Friend's display name"
              value={formData.playerName}
              onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
              disabled={isAdding}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="characterName">Character Name</Label>
            <Input
              id="characterName"
              placeholder="Thorin, Aria, etc."
              value={formData.characterName}
              onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
              disabled={isAdding}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="characterClass">
              {isNarrative ? 'Who is their character?' : 'Character Class/Role'}
            </Label>
            <Input
              id="characterClass"
              placeholder={isNarrative
                ? "A brave knight, a clever inventor, a wise healer..."
                : "Warrior, Mage, Rogue, Healer..."
              }
              value={formData.characterClass}
              onChange={(e) => setFormData({ ...formData, characterClass: e.target.value })}
              disabled={isAdding}
            />
            <p className="text-xs text-muted-foreground">
              Describe who they are in a few words
            </p>
          </div>

          {isNarrative && (
            <div className="space-y-2">
              <Label htmlFor="characterSpecial">What makes them special?</Label>
              <Input
                id="characterSpecial"
                placeholder="Can talk to animals, has a magic compass..."
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
              Cancel
            </Button>
            <Button type="submit" disabled={isAdding} className="flex-1">
              {isAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Player...
                </>
              ) : (
                'Add Player'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
