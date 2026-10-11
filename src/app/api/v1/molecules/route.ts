import type { TenantContext } from '@/types/biology';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { MoleculeRepository } from '@/libs/biology/MoleculeRepository';
import { db } from '@/libs/DB';
import { membershipsSchema } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const { orgId: clerkOrgId, userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizationId');
    let targetOrgId = clerkOrgId ?? requestedOrgId;
    let userRole = 'member';

    // Resolver organización y rol del usuario
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
      return NextResponse.json({ molecules: [] });
    }

    const tenantContext: TenantContext = {
      organizationId: targetOrgId,
      userId,
      role: userRole as TenantContext['role'],
    };

    const type = searchParams.get('type') ?? 'all';
    const status = searchParams.get('status') ?? 'all';
    const targetAtomId = searchParams.get('targetAtomId') ?? undefined;
    const limit = Number.parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = Number.parseInt(searchParams.get('offset') ?? '0', 10);

    const molecules = await MoleculeRepository.getMolecules(tenantContext, {
      type,
      status,
      targetAtomId,
      limit,
      offset,
    });

    return NextResponse.json({ molecules });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
