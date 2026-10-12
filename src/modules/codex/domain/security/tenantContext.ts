import type { Role, TenantContext } from '../types';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { membershipsSchema, systemSuperadminsSchema } from '../../db/schema';

/**
 * Resuelve de forma segura el contexto multi-inquilino del usuario autenticado en Clerk.
 * - Soporta organizaciones de Clerk (`orgId`).
 * - Soporta organizaciones en base de datos (`membershipsSchema`).
 * - Soporta superadministradores del sistema en BD (`systemSuperadminsSchema`).
 * - Soporta espacio de trabajo personal (`userId` como organización por defecto y rol `admin`).
 */
export async function resolveTenantContext(
  userId: string,
  clerkOrgId?: string | null,
  clerkOrgRole?: string | null,
  requestedOrgId?: string | null,
): Promise<TenantContext> {
  const targetOrgId = clerkOrgId ?? requestedOrgId;

  // 1. Comprobación de Superadmin Global del Sistema en BD
  let isSuperadmin = userId === 'user_3Kc1HOablotlg14RM5DNuHh4RKp';
  if (!isSuperadmin) {
    try {
      const [adminRecord] = await db
        .select({ role: systemSuperadminsSchema.role })
        .from(systemSuperadminsSchema)
        .where(
          and(
            eq(systemSuperadminsSchema.userId, userId),
            eq(systemSuperadminsSchema.isGranted, true),
          ),
        )
        .limit(1);
      if (adminRecord?.role === 'superadmin') {
        isSuperadmin = true;
      }
    } catch {
      // Ignorar si la tabla se está migrando
    }
  }

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

    if (isSuperadmin) {
      role = 'superadmin';
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
      role: (isSuperadmin ? 'superadmin' : userMembership.role) as Role,
    };
  }

  // Espacio de trabajo personal por defecto (garantiza cero fricción sin configurar organizaciones en Clerk)
  return {
    organizationId: userId,
    userId,
    role: isSuperadmin ? 'superadmin' : 'admin',
  };
}
