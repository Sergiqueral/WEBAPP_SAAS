// ==========================================
// MÓDULO LICENSING: MATRIZ DE PLANES
// ==========================================

import type { PlanDefinition, PlanTier } from './types';

export const DEFAULT_PLAN_TIER: PlanTier = 'alpha_tester';

export const PLANS: Record<PlanTier, PlanDefinition> = {
  alpha_tester: {
    tier: 'alpha_tester',
    name: 'Alpha Tester (Acceso Total Gratuito)',
    maxFreeMembers: 999,
    firstGuestTrialDays: 9999,
    maxOwnedFreeOrgsPerUser: 999,
    bypassAllRestrictions: true,
    features: {
      'google_sync:read': true,
      'google_sync:write': true,
      'connector:stel_order': true,
      'members:invite': true,
      'omnibar:advanced': true,
      'exports:data': true,
    },
  },

  free: {
    tier: 'free',
    name: 'Plan Gratuito',
    maxFreeMembers: 1, // 1 propietario gratuito incluido
    firstGuestTrialDays: 30, // 30 días de gracia para el 1er usuario invitado
    maxOwnedFreeOrgsPerUser: 1, // Anti-abuso: sólo 1 org gratis por usuario
    bypassAllRestrictions: false,
    features: {
      'google_sync:read': true, // Modo lectura es gratis
      'google_sync:write': false, // Modo edición/sincronización requiere Pro
      'connector:stel_order': false, // Add-on de pago
      'members:invite': true, // Permitido bajo regla de asiento o prueba
      'omnibar:advanced': true,
      'exports:data': false,
    },
  },

  pro: {
    tier: 'pro',
    name: 'Plan Profesional',
    maxFreeMembers: 5,
    firstGuestTrialDays: 30,
    maxOwnedFreeOrgsPerUser: 10,
    bypassAllRestrictions: false,
    features: {
      'google_sync:read': true,
      'google_sync:write': true, // Google bidireccional incluido
      'connector:stel_order': false, // Add-on mensual independiente
      'members:invite': true,
      'omnibar:advanced': true,
      'exports:data': true,
    },
  },

  enterprise: {
    tier: 'enterprise',
    name: 'Plan Empresa',
    maxFreeMembers: 50,
    firstGuestTrialDays: 60,
    maxOwnedFreeOrgsPerUser: 999,
    bypassAllRestrictions: false,
    features: {
      'google_sync:read': true,
      'google_sync:write': true,
      'connector:stel_order': true, // Conectores incluidos en Enterprise
      'members:invite': true,
      'omnibar:advanced': true,
      'exports:data': true,
    },
  },
};

export function getPlanDefinition(tier?: PlanTier | string | null): PlanDefinition {
  if (!tier || !(tier in PLANS)) {
    return PLANS[DEFAULT_PLAN_TIER];
  }
  return PLANS[tier as PlanTier];
}
