import type { TenantContext } from '@/types/biology';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AccessDeniedError, AccessGuard } from '@/libs/biology/AccessGuard';
import { SynapseRepository } from '@/libs/biology/SynapseRepository';
import { db } from '@/libs/DB';
import { membershipsSchema } from '@/models/Schema';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getTenantContext(userId: string, clerkOrgId?: string | null): Promise<TenantContext | null> {
  let targetOrgId = clerkOrgId;
  let userRole = 'member';

  if (targetOrgId) {
    const membership = await db.query.membershipsSchema.findFirst({
      where: eq(membershipsSchema.organizationId, targetOrgId),
    });
    if (membership) {
      userRole = membership.role;
    }
  } else {
    const userMembership = await db.query.membershipsSchema.findFirst({
      where: eq(membershipsSchema.userId, userId),
    });
    if (userMembership) {
      targetOrgId = userMembership.organizationId;
      userRole = userMembership.role;
    }
  }

  if (!targetOrgId) {
    return null;
  }

  return {
    organizationId: targetOrgId,
    userId,
    role: userRole as TenantContext['role'],
  };
}

export async function DELETE(_request: Request, props: RouteContext) {
  try {
    const { orgId, userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const tenantContext = await getTenantContext(userId, orgId);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
    }

    try {
      AccessGuard.assertCanWrite(tenantContext);
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      throw err;
    }

    const { id } = await props.params;
    const success = await SynapseRepository.deleteSynapse(tenantContext, id);

    return NextResponse.json({ success });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar sinapsis';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
