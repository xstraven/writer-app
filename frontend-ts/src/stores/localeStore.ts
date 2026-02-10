import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '@/hooks/useActiveLocale';

interface LocaleStore {
  overrideLocale: Locale | null;
  setOverrideLocale: (locale: Locale | null) => void;
}

/**
 * Store for managing locale overrides when not in a campaign.
 * Allows users to manually select a language in the lobby/campaign creation.
 */
export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      overrideLocale: null,
      setOverrideLocale: (locale) => set({ overrideLocale: locale }),
    }),
    {
      name: 'storycraft-locale',
    }
  )
);
