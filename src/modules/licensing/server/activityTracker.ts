import { eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { tenantSubscriptionsSchema } from '../db/schema';

// ==========================================
// MÓDULO LICENSING: MONITOR DE ACTIVIDAD CON THROTTLING
// Protege PostgreSQL de saturación: máximo 1 escritura al día por org
// ==========================================

export const ACTIVITY_THROTTLE_MS = 24 * 60 * 60 * 1000; // 24 Horas

export function shouldTouchActivity(
  lastActiveAt?: Date | null,
  now: Date = new Date(),
  thresholdMs: number = ACTIVITY_THROTTLE_MS,
): boolean {
  if (!lastActiveAt) {
    return true;
  }
  return (now.getTime() - lastActiveAt.getTime()) >= thresholdMs;
}

export async function touchTenantActivity(
  organizationId: string,
  now: Date = new Date(),
  thresholdMs: number = ACTIVITY_THROTTLE_MS,
): Promise<boolean> {
  if (!organizationId) {
    return false;
  }

  try {
    const [sub] = await db
      .select({
        id: tenantSubscriptionsSchema.id,
        lastActiveAt: tenantSubscriptionsSchema.lastActiveAt,
      })
      .from(tenantSubscriptionsSchema)
      .where(eq(tenantSubscriptionsSchema.organizationId, organizationId))
      .limit(1);

    if (!sub) {
      // Si la organización no existe aún en subscriptions, se creará al pedir el snapshot
      return false;
    }

    if (shouldTouchActivity(sub.lastActiveAt, now, thresholdMs)) {
      await db
        .update(tenantSubscriptionsSchema)
        .set({
          lastActiveAt: now,
          updatedAt: now,
        })
        .where(eq(tenantSubscriptionsSchema.id, sub.id));

      return true;
    }

    return false;
  } catch {
    // Falla silenciosa para no bloquear la petición de usuario si la DB está ocupada
    return false;
  }
}
