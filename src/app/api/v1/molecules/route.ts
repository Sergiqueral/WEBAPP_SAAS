import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/libs/auth/server-auth';
import { MoleculeRepository } from '@/modules/codex/domain/repositories/MoleculeRepository';
import { resolveTenantContext } from '@/modules/codex/domain/security/tenantContext';

export async function GET(request: Request) {
  try {
    const { orgId: currentOrgId, orgRole: currentOrgRole, userId } = await getServerAuthSession();

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizationId');

    const tenantContext = await resolveTenantContext(
      userId,
      currentOrgId,
      currentOrgRole,
      requestedOrgId,
    );

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
