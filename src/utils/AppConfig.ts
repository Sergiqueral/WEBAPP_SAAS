import type { LocalizationResource } from '@clerk/shared/types';
import type { LocalePrefixMode } from 'next-intl/routing';
import type { AppLocale } from '@/types/I18n';
import { enUS, esES, frFR } from '@clerk/localizations';

/** Locale prefix strategy for next-intl routing. */
const localePrefix: LocalePrefixMode = 'always';
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

// FIXME: Customize this configuration for your product
/** Centralized application configuration */
export const AppConfig = {
  name: 'SaaS Template',
  i18n: {
    locales,
    defaultLocale: 'es',
    localePrefix,
  },
  email: {
    support: 'contact@nextjs-boilerplate.com',
  },
} as const;

const customEsES: LocalizationResource = {
  ...esES,
  unstable__errors: {
    ...esES.unstable__errors,
    form_password_pwned: 'Por favor, elige una contraseña diferente y más segura para proteger tu cuenta.',
  },
};

const supportedLocales: Record<string, LocalizationResource> = {
  es: customEsES,
  en: enUS,
  fr: frFR,
};

export const ClerkLocalizations = {
  defaultLocale: customEsES,
  supportedLocales,
};

export const AllLocales = AppConfig.i18n.locales.map(locale => locale.id);
