// ==========================================
// MÓDULO LICENSING: MOTOR DE EVALUACIÓN DE CAPACIDADES
// Lógica pura desacoplada - Cero dependencias externas
// ==========================================

import type {
  EntitlementContext,
  EntitlementResult,
  FeatureKey,
  TenantSubscriptionSnapshot,
} from './types';
import { getPlanDefinition } from './plans';

export function calculateFirstGuestTrialEndDate(
  startDate: Date = new Date(),
  trialDays: number = 30,
): Date {
  const end = new Date(startDate.getTime());
  end.setDate(end.getDate() + trialDays);
  return end;
}

export function evaluateEntitlement(
  snapshot: TenantSubscriptionSnapshot,
  featureKey: FeatureKey,
  context: EntitlementContext = {},
): EntitlementResult {
  const now = context.now || new Date();

  // 1. Estado del Tenant: si está archivado o purgado, se deniega cualquier acción
  if (snapshot.status === 'archived' || snapshot.status === 'scheduled_for_deletion') {
    return {
      granted: false,
      code: 'TENANT_ARCHIVED',
      reason: 'La organización se encuentra archivada por inactividad.',
      metadata: { status: snapshot.status },
    };
  }

  const planDef = getPlanDefinition(snapshot.plan);

  // 2. Modo Alpha Tester (o bypass total): todo está 100% concedido
  if (planDef.bypassAllRestrictions) {
    return {
      granted: true,
      code: 'ALLOWED',
      reason: 'Acceso total concedido en fase Alpha Tester.',
      metadata: { tier: planDef.tier },
    };
  }

  // 3. Sobrescrituras del Superadmin (Excepciones manuales prevalecen sobre el plan)
  if (snapshot.overrides && snapshot.overrides.length > 0) {
    const override = snapshot.overrides.find(o => o.featureKey === featureKey);
    if (override) {
      const isExpired = override.expiresAt ? override.expiresAt.getTime() <= now.getTime() : false;
      if (!isExpired) {
        if (override.isGranted) {
          return {
            granted: true,
            code: 'ALLOWED',
            reason: override.reason || 'Concedido mediante excepción del superadmin.',
            metadata: { isOverride: true },
          };
        }
        return {
          granted: false,
          code: 'FORBIDDEN',
          reason: override.reason || 'Restringido explícitamente por el superadmin.',
          metadata: { isOverride: true },
        };
      }
    }
  }

  // 4. Complementos y Add-ons de conectividad (ej. STEL Order)
  if (snapshot.addons && snapshot.addons.length > 0) {
    const mappedAddonKey = featureKey.startsWith('connector:')
      ? featureKey.replace('connector:', '')
      : featureKey;

    const addon = snapshot.addons.find(
      a => a.addonKey === mappedAddonKey && a.status === 'active',
    );

    if (addon) {
      const isExpired = addon.expiresAt ? addon.expiresAt.getTime() <= now.getTime() : false;
      if (!isExpired) {
        return {
          granted: true,
          code: 'ALLOWED',
          reason: `Capacidad activa mediante el complemento ${addon.addonKey}.`,
          metadata: { addonKey: addon.addonKey },
        };
      }
    }
  }

  // 5. Caso especial: Asignación e Invitación de Miembros (`members:invite`)
  if (featureKey === 'members:invite') {
    const currentMembers = context.currentMembersCount ?? 1;
    const requestedTotal = currentMembers + 1;
    const baseQuota = planDef.maxFreeMembers;
    const paidQuota = snapshot.paidSeatsCount || 0;
    const totalAllowedSeats = baseQuota + paidQuota;

    // Si cabe en la cuota base + asientos pagados:
    if (requestedTotal <= totalAllowedSeats) {
      return {
        granted: true,
        code: 'ALLOWED',
        reason: 'Asiento disponible dentro de la cuota contratada.',
        metadata: { currentMembers, totalAllowedSeats },
      };
    }

    // Si excede la cuota contratada, comprobamos el periodo de prueba de 30 días del primer invitado
    if (snapshot.firstGuestTrialEndsAt) {
      const isTrialActive = snapshot.firstGuestTrialEndsAt.getTime() > now.getTime();
      if (isTrialActive) {
        return {
          granted: true,
          code: 'ALLOWED',
          reason: 'Asiento temporal concedido en el periodo de prueba de 30 días.',
          metadata: {
            trialEndsAt: snapshot.firstGuestTrialEndsAt,
            daysRemaining: Math.ceil(
              (snapshot.firstGuestTrialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            ),
          },
        };
      }
      return {
        granted: false,
        code: 'TRIAL_EXPIRED',
        reason: 'El periodo de prueba de 30 días para usuarios adicionales ha expirado. Requiere contratar asientos.',
        requiredTier: 'pro',
        metadata: { trialEndsAt: snapshot.firstGuestTrialEndsAt },
      };
    }

    // Primer usuario invitado que sobrepasa la cuota base: inicia el periodo de prueba
    return {
      granted: true,
      code: 'ALLOWED',
      reason: 'Se iniciará el periodo de prueba gratuito de 30 días para usuarios adicionales.',
      metadata: { startsTrial: true, trialDays: planDef.firstGuestTrialDays },
    };
  }

  // 6. Evaluación de la matriz estándar del Plan
  const isFeatureInPlan = Boolean(planDef.features[featureKey]);
  if (isFeatureInPlan) {
    return {
      granted: true,
      code: 'ALLOWED',
      reason: `Incluido en el ${planDef.name}.`,
    };
  }

  // Si no está incluido, especificamos la razón exacta (Add-on vs Upgrade de Plan)
  if (featureKey === 'connector:stel_order') {
    return {
      granted: false,
      code: 'ADDON_REQUIRED',
      requiredAddon: 'stel_order',
      reason: 'El conector STEL Order requiere contratar el complemento mensual.',
    };
  }

  if (featureKey === 'google_sync:write') {
    return {
      granted: false,
      code: 'UPGRADE_REQUIRED',
      requiredTier: 'pro',
      reason: 'La sincronización bidireccional con Google requiere el Plan Profesional.',
    };
  }

  return {
    granted: false,
    code: 'UPGRADE_REQUIRED',
    requiredTier: 'pro',
    reason: `La función '${featureKey}' requiere ampliar tu plan.`,
  };
}

export function canAccessFeature(
  snapshot: TenantSubscriptionSnapshot,
  featureKey: FeatureKey,
  context?: EntitlementContext,
): boolean {
  return evaluateEntitlement(snapshot, featureKey, context).granted;
}
