import type { routing } from '@/libs/I18nRouting';
import type messages from '@/locales/es.json';

declare module 'next-intl' {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}

export type AppLocale = {
  id: string;
  name: string;
};
