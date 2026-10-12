import type { Role, TenantContext } from '../types';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { membershipsSchema } from '../../db/schema';

/**
 * Resuelve de forma segura el contexto multi-inquilino del usuario autenticado en Clerk.
 * - Soporta organizaciones de Clerk (`orgId`).
 * - Soporta organizaciones en base de datos (`membershipsSchema`).
 * - Soporta espacio de trabajo personal (`userId` como organización por defecto y rol `admin`).
 */
export async function resolveTenantContext(
  userId: string,
  clerkOrgId?: string | null,
  clerkOrgRole?: string | null,
  requestedOrgId?: string | null,
): Promise<TenantContext> {
  const targetOrgId = clerkOrgId ?? requestedOrgId;

  if (targetOrgId) {
    let role: Role = clerkOrgRole === 'org:admin' ? 'admin' : 'member';

    const [membership] = await db
      .select({ role: membershipsSchema.role })
      .from(membershipsSchema)
      .where(
        and(
          eq(membershipsSchema.organizationId, targetOrgId),
          eq(membershipsSchema.userId, userId),
        ),
      )
      .limit(1);

    if (membership?.role) {
      role = membership.role as Role;
    }

    return {
      organizationId: targetOrgId,
      userId,
      role,
    };
  }

  // Buscar si el usuario tiene una membresía registrada en BD
  const [userMembership] = await db
    .select({
      organizationId: membershipsSchema.organizationId,
      role: membershipsSchema.role,
    })
    .from(membershipsSchema)
    .where(eq(membershipsSchema.userId, userId))
    .limit(1);

  if (userMembership) {
    return {
      organizationId: userMembership.organizationId,
      userId,
      role: userMembership.role as Role,
    };
  }

  // Espacio de trabajo personal por defecto (garantiza cero fricción sin configurar organizaciones en Clerk)
  return {
    organizationId: userId,
    userId,
    role: 'admin',
  };
}
