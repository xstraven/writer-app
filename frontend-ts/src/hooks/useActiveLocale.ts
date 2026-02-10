'use client';

import { useCampaignStore } from '@/stores/campaignStore';
import { useLocaleStore } from '@/stores/localeStore';
import { useState, useEffect } from 'react';

export type Locale = 'en' | 'de';

/**
 * Hook to get the active locale for the application.
 *
 * Priority order:
 * 1. The current campaign's language if in a campaign
 * 2. User's manual override (from language selector in CreateCampaignForm)
 * 3. Browser language if detected and supported (German -> 'de', else 'en')
 * 4. Default 'en' as fallback
 *
 * Note: Uses useState/useEffect to prevent hydration mismatches by ensuring
 * the initial client render matches the server render.
 */
export const useActiveLocale = (): Locale => {
  const campaign = useCampaignStore((state) => state.currentCampaign);
  const overrideLocale = useLocaleStore((state) => state.overrideLocale);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // If we have an active campaign, use its language
  if (campaign?.language) {
    return campaign.language as Locale;
  }

  // If user has manually selected a language (in CreateCampaignForm), use that
  if (overrideLocale) {
    return overrideLocale;
  }

  // Only detect browser language after hydration completes to prevent mismatch
  if (hasMounted && typeof navigator !== 'undefined') {
    const browserLang = navigator.language.toLowerCase();
    // Check for German language
    if (browserLang.startsWith('de')) {
      return 'de';
    }
  }

  // Default to English (both on server and during initial client render)
  return 'en';
};
