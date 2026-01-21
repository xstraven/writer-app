'use client';

import { CampaignCard } from './CampaignCard';
import type { CampaignWithPlayers } from '@/lib/types';

interface CampaignListProps {
  campaigns: CampaignWithPlayers[];
  isLoading?: boolean;
}

export function CampaignList({ campaigns, isLoading }: CampaignListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 rounded-lg border border-border bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No adventures yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new adventure or join one with an invite code
        </p>
      </div>
    );
  }

  // Sort: your turn first, then active, then by updated_at
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aIsYourTurn = a.your_player?.id === a.campaign.current_turn_player_id;
    const bIsYourTurn = b.your_player?.id === b.campaign.current_turn_player_id;

    if (aIsYourTurn && !bIsYourTurn) return -1;
    if (!aIsYourTurn && bIsYourTurn) return 1;

    const statusOrder = { active: 0, lobby: 1, paused: 2, completed: 3 };
    const aOrder = statusOrder[a.campaign.status] ?? 4;
    const bOrder = statusOrder[b.campaign.status] ?? 4;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return new Date(b.campaign.updated_at).getTime() - new Date(a.campaign.updated_at).getTime();
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedCampaigns.map((campaignData) => (
        <CampaignCard key={campaignData.campaign.id} campaignData={campaignData} />
      ))}
    </div>
  );
}
