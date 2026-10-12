import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { membershipsSchema } from '@/modules/codex/db/schema';
import { tenantSubscriptionsSchema } from '../db/schema';

// ==========================================
// MÓDULO LICENSING: GUARD ANTI-ABUSO MULTI-ORGANIZACIÓN
// Evita el "Free Infinito": máximo 1 organización gratuita como propietario
// ==========================================

export type OrgCreationCheckResult = {
  allowed: boolean;
  reason?: string;
  ownedFreeOrgsCount: number;
};

export async function canUserCreateFreeOrganization(
  userId: string,
): Promise<OrgCreationCheckResult> {
  if (!userId) {
    return {
      allowed: false,
      reason: 'Se requiere userId válido.',
      ownedFreeOrgsCount: 0,
    };
  }

  // 1. Buscar organizaciones donde este usuario sea el propietario ('owner')
  const ownedMemberships = await db
    .select({
      orgId: membershipsSchema.organizationId,
    })
    .from(membershipsSchema)
    .where(
      and(
        eq(membershipsSchema.userId, userId),
        eq(membershipsSchema.role, 'owner'),
      ),
    );

  if (ownedMemberships.length === 0) {
    return {
      allowed: true,
      ownedFreeOrgsCount: 0,
    };
  }

  // 2. Contar cuántas de esas organizaciones tienen el plan 'free'
  let freeOrgsCount = 0;

  for (const m of ownedMemberships) {
    const [sub] = await db
      .select({
        plan: tenantSubscriptionsSchema.plan,
      })
      .from(tenantSubscriptionsSchema)
      .where(eq(tenantSubscriptionsSchema.organizationId, m.orgId))
      .limit(1);

    if (sub && sub.plan === 'free') {
      freeOrgsCount += 1;
    }
  }

  // 3. Regla: si ya es dueño de 1 organización Free, no puede crear otra Free
  if (freeOrgsCount >= 1) {
    return {
      allowed: false,
      reason: 'Ya eres propietario de una organización gratuita. Para gestionar más organizaciones, amplía a un plan Profesional.',
      ownedFreeOrgsCount: freeOrgsCount,
    };
  }

  return {
    allowed: true,
    ownedFreeOrgsCount: freeOrgsCount,
  };
}
