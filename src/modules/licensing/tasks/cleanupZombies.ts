import type { PlanTier, TenantStatus } from '../domain/types';
import { and, eq, not, or } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { tenantSubscriptionsSchema } from '../db/schema';

// ==========================================
// MÓDULO LICENSING: TAREA DE CICLO DE VIDA Y LIMPIEZA DE CUENTAS ZOMBIS
// Inactividad: >60d dormant, >90d archived, >180d purga
// Protección: organizaciones con isProtected o plan alpha_tester están indultadas
// ==========================================

export const DORMANT_THRESHOLD_DAYS = 60;
export const ARCHIVED_THRESHOLD_DAYS = 90;
export const PURGE_THRESHOLD_DAYS = 180;

export function calculateInactiveDays(lastActiveAt: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - lastActiveAt.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function determineZombieStatus(
  sub: {
    lastActiveAt: Date;
    isProtected?: boolean;
    plan: PlanTier;
    status: TenantStatus;
  },
  now: Date = new Date(),
): TenantStatus {
  // 1. Cuentas protegidas manualmente por el superadmin o en plan Alpha Tester quedan indultadas
  if (sub.isProtected || sub.plan === 'alpha_tester') {
    return sub.status;
  }

  const inactiveDays = calculateInactiveDays(sub.lastActiveAt, now);

  if (inactiveDays >= PURGE_THRESHOLD_DAYS) {
    return 'scheduled_for_deletion';
  }

  if (inactiveDays >= ARCHIVED_THRESHOLD_DAYS) {
    return 'archived';
  }

  if (inactiveDays >= DORMANT_THRESHOLD_DAYS) {
    return 'dormant';
  }

  return 'active';
}

export async function runZombieLifecycleEvaluation(now: Date = new Date()): Promise<{
  processed: number;
  transitions: {
    toDormant: number;
    toArchived: number;
    toScheduledForDeletion: number;
  };
}> {
  // Obtener todas las organizaciones que no estén protegidas ni sean alpha_tester
  const candidateSubs = await db
    .select({
      id: tenantSubscriptionsSchema.id,
      organizationId: tenantSubscriptionsSchema.organizationId,
      plan: tenantSubscriptionsSchema.plan,
      status: tenantSubscriptionsSchema.status,
      isProtected: tenantSubscriptionsSchema.isProtected,
      lastActiveAt: tenantSubscriptionsSchema.lastActiveAt,
    })
    .from(tenantSubscriptionsSchema)
    .where(
      and(
        eq(tenantSubscriptionsSchema.isProtected, false),
        not(eq(tenantSubscriptionsSchema.plan, 'alpha_tester')),
        or(
          eq(tenantSubscriptionsSchema.status, 'active'),
          eq(tenantSubscriptionsSchema.status, 'dormant'),
          eq(tenantSubscriptionsSchema.status, 'archived'),
        ),
      ),
    );

  let toDormant = 0;
  let toArchived = 0;
  let toScheduledForDeletion = 0;

  for (const sub of candidateSubs) {
    const targetStatus = determineZombieStatus(
      {
        lastActiveAt: sub.lastActiveAt,
        isProtected: sub.isProtected,
        plan: sub.plan as PlanTier,
        status: sub.status as TenantStatus,
      },
      now,
    );

    if (targetStatus !== sub.status) {
      if (targetStatus === 'dormant') {
        toDormant += 1;
      } else if (targetStatus === 'archived') {
        toArchived += 1;
      } else if (targetStatus === 'scheduled_for_deletion') {
        toScheduledForDeletion += 1;
      }

      await db
        .update(tenantSubscriptionsSchema)
        .set({
          status: targetStatus,
          updatedAt: now,
        })
        .where(eq(tenantSubscriptionsSchema.id, sub.id));
    }
  }

  return {
    processed: candidateSubs.length,
    transitions: {
      toDormant,
      toArchived,
      toScheduledForDeletion,
    },
  };
}
