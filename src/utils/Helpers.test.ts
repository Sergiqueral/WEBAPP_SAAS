import { describe, expect, it } from 'vitest';
import { routing } from '@/libs/I18nRouting';
import { getI18nPath } from './Helpers';

describe('Helpers', () => {
  describe('I18n path helper', () => {
    it('prefixes path correctly according to routing localePrefix configuration', () => {
      const url = '/random-url';
      const defaultLocale = routing.defaultLocale;

      if (routing.localePrefix === 'always') {
        expect(getI18nPath(url, defaultLocale)).toBe(`/${defaultLocale}${url}`);
      } else {
        expect(getI18nPath(url, defaultLocale)).toBe(url);
      }
    });

    it('prefixes path with locale when locale is not default', () => {
      const url = '/random-url';
      const locale = 'fr';

      expect(getI18nPath(url, locale)).toBe(`/fr${url}`);
    });
  });
});
