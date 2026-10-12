import type {
  AddonKey,
  FeatureKey,
  PlanTier,
  TenantAddonData,
  TenantSubscriptionSnapshot,
} from '../domain/types';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  tenantAddonsSchema,
  tenantFeatureOverridesSchema,
  tenantSubscriptionsSchema,
} from '../db/schema';
import { calculateFirstGuestTrialEndDate } from '../domain/EntitlementEngine';
import { DEFAULT_PLAN_TIER } from '../domain/plans';

// ==========================================
// MÓDULO LICENSING: REPOSITORIO DE PERSISTENCIA
// ==========================================

export async function getTenantSubscriptionSnapshot(
  organizationId: string,
): Promise<TenantSubscriptionSnapshot> {
  if (!organizationId) {
    throw new Error('organizationId es obligatorio para obtener las licencias.');
  }

  // 1. Obtener o crear la suscripción base
  let [sub] = await db
    .select()
    .from(tenantSubscriptionsSchema)
    .where(eq(tenantSubscriptionsSchema.organizationId, organizationId))
    .limit(1);

  if (!sub) {
    const now = new Date();
    const [inserted] = await db
      .insert(tenantSubscriptionsSchema)
      .values({
        organizationId,
        plan: DEFAULT_PLAN_TIER, // 'alpha_tester' por defecto para dar acceso a los amigos
        status: 'active',
        lastActiveAt: now,
        paidSeatsCount: 0,
      })
      .returning();

    sub = inserted;
  }

  if (!sub) {
    throw new Error(`No se pudo inicializar la suscripción para ${organizationId}`);
  }

  // 2. Obtener complementos (addons)
  const addonsRows = await db
    .select()
    .from(tenantAddonsSchema)
    .where(eq(tenantAddonsSchema.organizationId, organizationId));

  const addons: TenantAddonData[] = addonsRows.map(r => ({
    addonKey: r.addonKey as AddonKey,
    status: r.status as 'active' | 'paused' | 'canceled',
    expiresAt: r.expiresAt,
  }));

  // 3. Obtener excepciones del superadmin (overrides)
  const overrideRows = await db
    .select()
    .from(tenantFeatureOverridesSchema)
    .where(eq(tenantFeatureOverridesSchema.organizationId, organizationId));

  const overrides = overrideRows.map(r => ({
    featureKey: r.featureKey as FeatureKey,
    isGranted: r.isGranted,
    reason: r.reason,
    expiresAt: r.expiresAt,
  }));

  return {
    organizationId: sub.organizationId,
    plan: sub.plan as PlanTier,
    status: sub.status as 'active' | 'dormant' | 'archived' | 'scheduled_for_deletion',
    isProtected: sub.isProtected,
    lastActiveAt: sub.lastActiveAt,
    firstGuestTrialStartedAt: sub.firstGuestTrialStartedAt,
    firstGuestTrialEndsAt: sub.firstGuestTrialEndsAt,
    paidSeatsCount: sub.paidSeatsCount,
    metadata: sub.metadata as Record<string, unknown>,
    addons,
    overrides,
  };
}

export async function recordFirstGuestTrialStart(
  organizationId: string,
  trialDays: number = 30,
): Promise<Date> {
  const [sub] = await db
    .select()
    .from(tenantSubscriptionsSchema)
    .where(eq(tenantSubscriptionsSchema.organizationId, organizationId))
    .limit(1);

  if (!sub) {
    throw new Error('Suscripción no encontrada.');
  }

  // Anti-abuso: si el reloj de prueba ya fue iniciado alguna vez, NO se reinicia
  if (sub.firstGuestTrialEndsAt) {
    return sub.firstGuestTrialEndsAt;
  }

  const start = new Date();
  const end = calculateFirstGuestTrialEndDate(start, trialDays);

  await db
    .update(tenantSubscriptionsSchema)
    .set({
      firstGuestTrialStartedAt: start,
      firstGuestTrialEndsAt: end,
      updatedAt: new Date(),
    })
    .where(eq(tenantSubscriptionsSchema.id, sub.id));

  return end;
}

// ----------------------------------------------------
// ACCIONES DE SUPERADMIN (CONTROL TOTAL PARA PROGRAMADOR)
// ----------------------------------------------------

export async function setTenantPlan(
  organizationId: string,
  plan: PlanTier,
): Promise<void> {
  await db
    .insert(tenantSubscriptionsSchema)
    .values({
      organizationId,
      plan,
      status: 'active',
    })
    .onConflictDoUpdate({
      target: tenantSubscriptionsSchema.organizationId,
      set: {
        plan,
        updatedAt: new Date(),
      },
    });
}

export async function setTenantProtection(
  organizationId: string,
  isProtected: boolean,
): Promise<void> {
  await db
    .update(tenantSubscriptionsSchema)
    .set({
      isProtected,
      updatedAt: new Date(),
    })
    .where(eq(tenantSubscriptionsSchema.organizationId, organizationId));
}

export async function upsertFeatureOverride(
  organizationId: string,
  featureKey: FeatureKey,
  isGranted: boolean,
  reason?: string,
  expiresAt?: Date | null,
): Promise<void> {
  await db
    .insert(tenantFeatureOverridesSchema)
    .values({
      organizationId,
      featureKey,
      isGranted,
      reason,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        tenantFeatureOverridesSchema.organizationId,
        tenantFeatureOverridesSchema.featureKey,
      ],
      set: {
        isGranted,
        reason,
        expiresAt,
        updatedAt: new Date(),
      },
    });
}

export async function removeFeatureOverride(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<void> {
  await db
    .delete(tenantFeatureOverridesSchema)
    .where(
      and(
        eq(tenantFeatureOverridesSchema.organizationId, organizationId),
        eq(tenantFeatureOverridesSchema.featureKey, featureKey),
      ),
    );
}

export async function upsertTenantAddon(
  organizationId: string,
  addonKey: AddonKey,
  status: 'active' | 'paused' | 'canceled' = 'active',
  expiresAt?: Date | null,
): Promise<void> {
  await db
    .insert(tenantAddonsSchema)
    .values({
      organizationId,
      addonKey,
      status,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [
        tenantAddonsSchema.organizationId,
        tenantAddonsSchema.addonKey,
      ],
      set: {
        status,
        expiresAt,
        updatedAt: new Date(),
      },
    });
}
