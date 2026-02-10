'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useActiveLocale } from '@/hooks/useActiveLocale';
import { useMemo } from 'react';

// Import messages statically at build time
import enMessages from '../../../messages/en.json';
import deMessages from '../../../messages/de.json';

const messagesMap: Record<string, any> = {
  en: enMessages,
  de: deMessages,
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useActiveLocale();

  // Get messages for the current locale
  const messages = useMemo(() => {
    return messagesMap[locale] || messagesMap.en;
  }, [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
