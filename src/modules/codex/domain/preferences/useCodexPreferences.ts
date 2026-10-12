'use client';

import { useCallback, useEffect, useState } from 'react';

export type OmnibarDisplayMode = 'fixed' | 'floating';
export type ThemeMode = 'dark' | 'light' | 'system';

export type CodexPreferences = {
  omnibarMode: OmnibarDisplayMode;
  theme: ThemeMode;
};

export const PREFERENCES_STORAGE_KEY = 'codex_user_preferences_v1';

export const DEFAULT_PREFERENCES: CodexPreferences = {
  omnibarMode: 'fixed',
  theme: 'system',
};

export function getInitialPreferences(storage?: Storage): CodexPreferences {
  if (!storage) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const stored = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {
    // Ignorar fallo de parseo
  }
  return DEFAULT_PREFERENCES;
}

export function savePreferences(prefs: CodexPreferences, storage?: Storage): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignorar fallo de almacenamiento
  }
}

export function resolveIsDark(theme: ThemeMode, systemPrefersDark: boolean): boolean {
  if (theme === 'dark') {
    return true;
  }
  if (theme === 'light') {
    return false;
  }
  return systemPrefersDark;
}

function applyThemeToDOM(theme: ThemeMode) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

  const isDark = resolveIsDark(theme, systemPrefersDark);
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useCodexPreferences() {
  const [preferences, setPreferences] = useState<CodexPreferences>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_PREFERENCES;
    }
    return getInitialPreferences(window.localStorage);
  });

  // Aplicar tema en el montaje inicial y escuchar cambios del sistema
  useEffect(() => {
    applyThemeToDOM(preferences.theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (preferences.theme === 'system') {
        applyThemeToDOM('system');
      }
    };

    mediaQuery.addEventListener?.('change', handleSystemChange);
    return () => mediaQuery.removeEventListener?.('change', handleSystemChange);
  }, [preferences.theme]);

  // Escuchar sincronización entre pestañas o componentes
  useEffect(() => {
    const handlePreferencesEvent = (e: Event) => {
      const customEvent = e as CustomEvent<CodexPreferences>;
      if (customEvent.detail) {
        setPreferences(customEvent.detail);
      }
    };

    window.addEventListener('codex:preferences_changed', handlePreferencesEvent);
    return () => window.removeEventListener('codex:preferences_changed', handlePreferencesEvent);
  }, []);

  const updatePreferences = useCallback((updates: Partial<CodexPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates };
      if (typeof window !== 'undefined') {
        savePreferences(next, window.localStorage);
      }
      applyThemeToDOM(next.theme);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('codex:preferences_changed', { detail: next }),
        );
      }
      return next;
    });
  }, []);

  const setOmnibarMode = useCallback((mode: OmnibarDisplayMode) => {
    updatePreferences({ omnibarMode: mode });
  }, [updatePreferences]);

  const setTheme = useCallback((theme: ThemeMode) => {
    updatePreferences({ theme });
  }, [updatePreferences]);

  return {
    preferences,
    omnibarMode: preferences.omnibarMode,
    theme: preferences.theme,
    setOmnibarMode,
    setTheme,
    updatePreferences,
  };
}
