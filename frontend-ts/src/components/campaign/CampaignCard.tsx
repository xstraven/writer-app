'use client';

import { useRouter } from 'next/navigation';
import { Users, Clock, Swords, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CampaignWithPlayers } from '@/lib/types';

interface CampaignCardProps {
  campaignData: CampaignWithPlayers;
}

export function CampaignCard({ campaignData }: CampaignCardProps) {
  const router = useRouter();
  const { campaign, players, your_player } = campaignData;

  const isYourTurn = your_player?.id === campaign.current_turn_player_id;
  const isCreator = your_player?.is_gm;

  const statusColors: Record<string, string> = {
    lobby: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    paused: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  const handleClick = () => {
    router.push(`/campaigns/${campaign.id}`);
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg relative overflow-hidden"
      onClick={handleClick}
    >
      {isYourTurn && campaign.status === 'active' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse" />
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold truncate pr-2">
            {campaign.name}
          </CardTitle>
          <Badge className={`${statusColors[campaign.status]} shrink-0`}>
            {campaign.status === 'active' && isYourTurn ? 'Your Turn!' : campaign.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {campaign.world_setting.slice(0, 100)}
          {campaign.world_setting.length > 100 ? '...' : ''}
        </p>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{players.length} player{players.length !== 1 ? 's' : ''}</span>
          </div>

          {campaign.status === 'active' && (
            <div className="flex items-center gap-1">
              <Swords className="h-4 w-4" />
              <span>Turn {campaign.turn_number}</span>
            </div>
          )}

          {isCreator && (
            <div className="flex items-center gap-1 text-amber-500">
              <Crown className="h-4 w-4" />
              <span>GM</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {players.slice(0, 4).map((player) => (
            <Badge
              key={player.id}
              variant="outline"
              className={`text-xs ${
                player.id === campaign.current_turn_player_id
                  ? 'border-green-500 text-green-500'
                  : ''
              }`}
            >
              {player.character_sheet?.name || player.name}
              {player.is_gm && ' (GM)'}
            </Badge>
          ))}
          {players.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{players.length - 4} more
            </Badge>
          )}
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            Updated {new Date(campaign.updated_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
