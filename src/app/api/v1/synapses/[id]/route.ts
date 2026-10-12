import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { SynapseRepository } from '@/modules/codex/domain/repositories/SynapseRepository';
import { AccessGuard } from '@/modules/codex/domain/security/AccessGuard';
import { resolveTenantContext } from '@/modules/codex/domain/security/tenantContext';
import { AccessDeniedError } from '@/modules/codex/domain/types';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, props: RouteContext) {
  try {
    const { orgId, orgRole, userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const tenantContext = await resolveTenantContext(userId, orgId, orgRole);

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
