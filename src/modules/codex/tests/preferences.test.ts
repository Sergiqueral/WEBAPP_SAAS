import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  getInitialPreferences,
  PREFERENCES_STORAGE_KEY,
  resolveIsDark,
  savePreferences,
} from '../domain/preferences/useCodexPreferences';

describe('Dominio de Preferencias Codex (Omnibarra Fija/Flotante y Tema)', () => {
  let mockStorage: Record<string, string> = {};
  let storageStub: Storage;

  beforeEach(() => {
    mockStorage = {};
    storageStub = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      key: () => null,
      length: 0,
    };
  });

  it('retorna preferencias predeterminadas correctas cuando el almacenamiento está vacío', () => {
    const prefs = getInitialPreferences(storageStub);

    expect(prefs.omnibarMode).toBe('fixed');
    expect(prefs.theme).toBe('system');
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('recupera preferencias persistidas en localStorage', () => {
    mockStorage[PREFERENCES_STORAGE_KEY] = JSON.stringify({
      omnibarMode: 'floating',
      theme: 'dark',
    });

    const prefs = getInitialPreferences(storageStub);

    expect(prefs.omnibarMode).toBe('floating');
    expect(prefs.theme).toBe('dark');
  });

  it('guarda correctamente preferencias actualizadas en storage', () => {
    savePreferences(
      {
        omnibarMode: 'floating',
        theme: 'light',
      },
      storageStub,
    );

    const raw = mockStorage[PREFERENCES_STORAGE_KEY];

    expect(raw).toBeDefined();

    const parsed = JSON.parse(raw!);

    expect(parsed.omnibarMode).toBe('floating');
    expect(parsed.theme).toBe('light');
  });

  it('resuelve el estado oscuro/claro según el tema explícito o el sistema', () => {
    // Tema 'dark' siempre es true
    expect(resolveIsDark('dark', false)).toBe(true);
    expect(resolveIsDark('dark', true)).toBe(true);

    // Tema 'light' siempre es false
    expect(resolveIsDark('light', false)).toBe(false);
    expect(resolveIsDark('light', true)).toBe(false);

    // Tema 'system' depende del sistema operativo
    expect(resolveIsDark('system', false)).toBe(false);
    expect(resolveIsDark('system', true)).toBe(true);
  });
});
