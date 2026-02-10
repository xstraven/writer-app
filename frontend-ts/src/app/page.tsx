'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UserPlus, Swords, Dices, Sparkles, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CampaignList } from '@/components/campaign/CampaignList';
import { useCampaignStore } from '@/stores/campaignStore';
import { useLocaleStore } from '@/stores/localeStore';
import { listCampaigns } from '@/lib/api';
import { useExperimentalDarkMode } from '@/hooks/useExperimentalDarkMode';
import { useTranslations } from 'next-intl';
import { useActiveLocale, type Locale } from '@/hooks/useActiveLocale';

export default function Home() {
  const router = useRouter();
  useExperimentalDarkMode();
  const t = useTranslations('home');
  const currentLocale = useActiveLocale();
  const { setOverrideLocale } = useLocaleStore();

  const {
    campaigns,
    isLoadingCampaigns,
    initSession,
    setCampaigns,
    setIsLoadingCampaigns,
  } = useCampaignStore();

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, [initSession]);

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      setIsLoadingCampaigns(true);
      try {
        const data = await listCampaigns();
        setCampaigns(data);
      } catch (error) {
        console.error('Failed to load campaigns:', error);
      } finally {
        setIsLoadingCampaigns(false);
      }
    };

    loadCampaigns();
  }, [setCampaigns, setIsLoadingCampaigns]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                <Dices className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('description')}
                </p>
              </div>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <Select
                value={currentLocale}
                onValueChange={(value) => setOverrideLocale(value as Locale)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇺🇸 English</SelectItem>
                  <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Start - Simple RPG */}
        <div className="mb-8">
          <Button
            size="lg"
            className="w-full h-20 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            onClick={() => router.push('/simple-rpg')}
          >
            <Sparkles className="h-6 w-6 mr-3" />
            <div className="text-left">
              <div>{t('quickAdventureTitle')}</div>
              <div className="text-sm font-normal opacity-90">{t('quickAdventureDescription')}</div>
            </div>
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button
            size="lg"
            className="flex-1 h-16 text-lg"
            onClick={() => router.push('/campaigns/new')}
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('createButton')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="flex-1 h-16 text-lg"
            onClick={() => router.push('/campaigns/join')}
          >
            <UserPlus className="h-5 w-5 mr-2" />
            {t('joinButton')}
          </Button>
        </div>

        {/* Campaigns Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Swords className="h-5 w-5" />
              {t('yourAdventures')}
            </h2>
          </div>

          <CampaignList campaigns={campaigns} isLoading={isLoadingCampaigns} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          {t('footer')}
        </div>
      </footer>
    </div>
  );
}
