import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { SynapseRepository } from '@/modules/codex/domain/repositories/SynapseRepository';
import { AccessGuard } from '@/modules/codex/domain/security/AccessGuard';
import { resolveTenantContext } from '@/modules/codex/domain/security/tenantContext';
import { AccessDeniedError, SynapseInputSchema } from '@/modules/codex/domain/types';

export async function POST(request: Request) {
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

    const body = await request.json();
    const validated = SynapseInputSchema.parse(body);

    const synapse = await SynapseRepository.createSynapse(tenantContext, validated);

    return NextResponse.json({ synapse }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear sinapsis';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
