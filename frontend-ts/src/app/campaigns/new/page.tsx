'use client';

import { CreateCampaignForm } from '@/components/campaign/CreateCampaignForm';

export default function NewCampaignPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <CreateCampaignForm />
      </div>
    </div>
  );
}
