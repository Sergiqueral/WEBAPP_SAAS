import type { TenantSubscriptionSnapshot } from '../domain/types';
import { describe, expect, it } from 'vitest';
import {
  calculateFirstGuestTrialEndDate,
  canAccessFeature,
  evaluateEntitlement,
} from '../domain/EntitlementEngine';

describe('Motor de Capacidades y Licencias (EntitlementEngine)', () => {
  const baseAlphaTesterSnapshot: TenantSubscriptionSnapshot = {
    organizationId: 'org_tester_123',
    plan: 'alpha_tester',
    status: 'active',
    lastActiveAt: new Date(),
    paidSeatsCount: 0,
  };

  const baseFreeSnapshot: TenantSubscriptionSnapshot = {
    organizationId: 'org_free_456',
    plan: 'free',
    status: 'active',
    lastActiveAt: new Date(),
    paidSeatsCount: 0,
  };

  describe('1. Comportamiento en Modo Alpha Tester (Amigos y Pruebas)', () => {
    it('concede acceso total inmediato a todas las funciones sin restricciones', () => {
      expect(canAccessFeature(baseAlphaTesterSnapshot, 'google_sync:write')).toBe(true);
      expect(canAccessFeature(baseAlphaTesterSnapshot, 'connector:stel_order')).toBe(true);
      expect(canAccessFeature(baseAlphaTesterSnapshot, 'members:invite', { currentMembersCount: 50 })).toBe(true);
      expect(canAccessFeature(baseAlphaTesterSnapshot, 'exports:data')).toBe(true);
    });

    it('devuelve código ALLOWED con metadatos de alpha_tester', () => {
      const res = evaluateEntitlement(baseAlphaTesterSnapshot, 'connector:stel_order');

      expect(res.granted).toBe(true);
      expect(res.code).toBe('ALLOWED');
      expect(res.reason).toContain('Alpha Tester');
    });
  });

  describe('2. Comportamiento en Plan Gratuito (Free Tier)', () => {
    it('permite Google en modo lectura pero bloquea modo edición/escritura', () => {
      const readRes = evaluateEntitlement(baseFreeSnapshot, 'google_sync:read');

      expect(readRes.granted).toBe(true);
      expect(readRes.code).toBe('ALLOWED');

      const writeRes = evaluateEntitlement(baseFreeSnapshot, 'google_sync:write');

      expect(writeRes.granted).toBe(false);
      expect(writeRes.code).toBe('UPGRADE_REQUIRED');
      expect(writeRes.requiredTier).toBe('pro');
    });

    it('bloquea conectores externos (STEL Order) indicando la necesidad de Add-on', () => {
      const stelRes = evaluateEntitlement(baseFreeSnapshot, 'connector:stel_order');

      expect(stelRes.granted).toBe(false);
      expect(stelRes.code).toBe('ADDON_REQUIRED');
      expect(stelRes.requiredAddon).toBe('stel_order');
    });
  });

  describe('3. Reloj de 30 Días para el Primer Invitado (Bolsa de Organización)', () => {
    const fixedNow = new Date('2026-05-01T12:00:00Z');

    it('permite añadir el primer invitado indicando que inicia la prueba de 30 días', () => {
      const res = evaluateEntitlement(baseFreeSnapshot, 'members:invite', {
        currentMembersCount: 1, // Ya está el propietario, quiere añadir el 2º
        now: fixedNow,
      });

      expect(res.granted).toBe(true);
      expect(res.metadata?.startsTrial).toBe(true);
      expect(res.metadata?.trialDays).toBe(30);
    });

    it('permite el acceso si la prueba de 30 días está activa (día 15)', () => {
      const trialSnapshot: TenantSubscriptionSnapshot = {
        ...baseFreeSnapshot,
        firstGuestTrialStartedAt: new Date('2026-04-16T12:00:00Z'),
        firstGuestTrialEndsAt: new Date('2026-05-16T12:00:00Z'), // Faltan 15 días
      };

      const res = evaluateEntitlement(trialSnapshot, 'members:invite', {
        currentMembersCount: 2,
        now: fixedNow,
      });

      expect(res.granted).toBe(true);
      expect(res.code).toBe('ALLOWED');
      expect(res.metadata?.daysRemaining).toBe(15);
    });

    it('bloquea con TRIAL_EXPIRED cuando se superan los 30 días', () => {
      const expiredSnapshot: TenantSubscriptionSnapshot = {
        ...baseFreeSnapshot,
        firstGuestTrialStartedAt: new Date('2026-03-01T12:00:00Z'),
        firstGuestTrialEndsAt: new Date('2026-03-31T12:00:00Z'), // Expiró hace un mes
      };

      const res = evaluateEntitlement(expiredSnapshot, 'members:invite', {
        currentMembersCount: 2,
        now: fixedNow,
      });

      expect(res.granted).toBe(false);
      expect(res.code).toBe('TRIAL_EXPIRED');
      expect(res.requiredTier).toBe('pro');
    });

    it('permite invitar si la organización ha comprado asientos adicionales de pago', () => {
      const expiredWithPaidSeatSnapshot: TenantSubscriptionSnapshot = {
        ...baseFreeSnapshot,
        firstGuestTrialEndsAt: new Date('2026-03-31T12:00:00Z'), // Expirado
        paidSeatsCount: 2, // 1 base gratis + 2 comprados = 3 asientos totales
      };

      const res = evaluateEntitlement(expiredWithPaidSeatSnapshot, 'members:invite', {
        currentMembersCount: 2, // 2 miembros actuales + 1 nuevo = 3 (cabe en cuota)
        now: fixedNow,
      });

      expect(res.granted).toBe(true);
      expect(res.code).toBe('ALLOWED');
    });

    it('calcula correctamente la fecha límite de 30 días', () => {
      const start = new Date('2026-01-01T00:00:00Z');
      const end = calculateFirstGuestTrialEndDate(start, 30);

      expect(end.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    });
  });

  describe('4. Sobrescrituras del Superadmin (Excepciones del Programador)', () => {
    it('concede STEL Order a una organización Free si el superadmin lo autorizó', () => {
      const snapshotWithOverride: TenantSubscriptionSnapshot = {
        ...baseFreeSnapshot,
        overrides: [
          {
            featureKey: 'connector:stel_order',
            isGranted: true,
            reason: 'Acceso especial concedido por Sergi',
          },
        ],
      };

      const res = evaluateEntitlement(snapshotWithOverride, 'connector:stel_order');

      expect(res.granted).toBe(true);
      expect(res.code).toBe('ALLOWED');
      expect(res.reason).toContain('Sergi');
    });

    it('ignora la sobrescritura si ha caducado en el tiempo', () => {
      const snapshotWithExpiredOverride: TenantSubscriptionSnapshot = {
        ...baseFreeSnapshot,
        overrides: [
          {
            featureKey: 'connector:stel_order',
            isGranted: true,
            expiresAt: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      };

      const res = evaluateEntitlement(snapshotWithExpiredOverride, 'connector:stel_order', {
        now: new Date('2026-05-01T00:00:00Z'),
      });

      // Como caducó, vuelve a la regla de plan Free
      expect(res.granted).toBe(false);
      expect(res.code).toBe('ADDON_REQUIRED');
    });

    it('permite al superadmin restringir explícitamente una función aunque esté en un plan superior', () => {
      const proWithRestriction: TenantSubscriptionSnapshot = {
        organizationId: 'org_pro',
        plan: 'pro',
        status: 'active',
        lastActiveAt: new Date(),
        paidSeatsCount: 0,
        overrides: [
          {
            featureKey: 'google_sync:write',
            isGranted: false,
            reason: 'Sincronización pausada por mantenimiento',
          },
        ],
      };

      const res = evaluateEntitlement(proWithRestriction, 'google_sync:write');

      expect(res.granted).toBe(false);
      expect(res.code).toBe('FORBIDDEN');
      expect(res.reason).toContain('mantenimiento');
    });
  });

  describe('5. Complementos y Add-ons Contratados', () => {
    it('concede STEL Order a un plan Free si tiene el addon stel_order activo', () => {
      const snapshotWithAddon: TenantSubscriptionSnapshot = {
        ...baseFreeSnapshot,
        addons: [
          {
            addonKey: 'stel_order',
            status: 'active',
          },
        ],
      };

      const res = evaluateEntitlement(snapshotWithAddon, 'connector:stel_order');

      expect(res.granted).toBe(true);
      expect(res.code).toBe('ALLOWED');
    });

    it('deniega si el addon está pausado o cancelado', () => {
      const snapshotWithPausedAddon: TenantSubscriptionSnapshot = {
        ...baseFreeSnapshot,
        addons: [
          {
            addonKey: 'stel_order',
            status: 'paused',
          },
        ],
      };

      const res = evaluateEntitlement(snapshotWithPausedAddon, 'connector:stel_order');

      expect(res.granted).toBe(false);
      expect(res.code).toBe('ADDON_REQUIRED');
    });
  });

  describe('6. Aislamiento Multi-Tenancy (Organizaciones Diferentes)', () => {
    it('evalúa los derechos independientemente según la organización activa', () => {
      const orgA_Free = baseFreeSnapshot;
      const orgB_Pro: TenantSubscriptionSnapshot = {
        organizationId: 'org_constructora_b',
        plan: 'pro',
        status: 'active',
        lastActiveAt: new Date(),
        paidSeatsCount: 0,
      };

      // Si el usuario consulta para Org A -> denegado
      expect(canAccessFeature(orgA_Free, 'google_sync:write')).toBe(false);

      // Si el mismo usuario consulta para Org B -> concedido
      expect(canAccessFeature(orgB_Pro, 'google_sync:write')).toBe(true);
    });
  });

  describe('7. Ciclo de Vida y Organizaciones Archivadas (Zombis)', () => {
    it('deniega cualquier función si la organización está archivada por inactividad', () => {
      const archivedSnapshot: TenantSubscriptionSnapshot = {
        ...baseAlphaTesterSnapshot,
        status: 'archived',
      };

      const res = evaluateEntitlement(archivedSnapshot, 'google_sync:read');

      expect(res.granted).toBe(false);
      expect(res.code).toBe('TENANT_ARCHIVED');
    });
  });
});
