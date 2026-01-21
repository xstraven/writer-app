'use client';

import { AdventureView } from '@/components/rpg/AdventureView';

interface CampaignPageProps {
  params: { id: string };
}

export default function CampaignPage({ params }: CampaignPageProps) {
  const { id } = params;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <AdventureView campaignId={id} />
      </div>
    </div>
  );
}
