import type { LocalePrefixMode } from 'next-intl/routing';
import type { AppLocale } from '@/types/I18n';

/** Locale prefix strategy for next-intl routing. */
const localePrefix: LocalePrefixMode = 'as-needed';
const locales = [
  {
    id: 'es',
    name: 'Español',
  },
  {
    id: 'en',
    name: 'English',
  },
  {
    id: 'fr',
    name: 'Français',
  },
] satisfies AppLocale[];

/** Centralized application configuration */
export const AppConfig = {
  name: 'Gorila',
  i18n: {
    locales,
    defaultLocale: 'es',
    localePrefix,
  },
  email: {
    support: 'squeral@serveix.me',
  },
} as const;

export const AllLocales = AppConfig.i18n.locales.map(locale => locale.id);
