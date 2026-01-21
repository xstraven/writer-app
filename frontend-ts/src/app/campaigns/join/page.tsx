'use client';

import { Suspense } from 'react';
import { JoinCampaignForm } from '@/components/campaign/JoinCampaignForm';

function JoinContent() {
  return <JoinCampaignForm />;
}

export default function JoinCampaignPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Suspense fallback={<div>Loading...</div>}>
          <JoinContent />
        </Suspense>
      </div>
    </div>
  );
}
