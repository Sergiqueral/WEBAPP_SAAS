import { describe, expect, it } from 'vitest';
import { clearEntitlementsCache } from '../hooks/useFeatureGate';

describe('Hook de Licenciamiento y Caché de Cliente (useFeatureGate)', () => {
  it('permite limpiar la caché de entitlements sin errores', () => {
    expect(() => clearEntitlementsCache()).not.toThrow();
  });
});
