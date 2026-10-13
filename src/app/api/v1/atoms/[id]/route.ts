import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/libs/auth/server-auth';
import { MoleculeRepository } from '@/modules/codex/domain/repositories/MoleculeRepository';
import { SynapseRepository } from '@/modules/codex/domain/repositories/SynapseRepository';
import { AccessGuard } from '@/modules/codex/domain/security/AccessGuard';
import { resolveTenantContext } from '@/modules/codex/domain/security/tenantContext';
import { AccessDeniedError, UpdateAtomInputSchema } from '@/modules/codex/domain/types';
import { OmnibarParser } from '@/modules/codex/omnibar/parser/OmnibarParser';
import { OmnibarReactor } from '@/modules/codex/omnibar/reactor/OmnibarReactor';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, props: RouteContext) {
  try {
    const { orgId, orgRole, userId } = await getServerAuthSession();

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const tenantContext = await resolveTenantContext(userId, orgId, orgRole);
    const { id } = await props.params;
    const molecule = await SynapseRepository.getMolecule(tenantContext, id);

    return NextResponse.json({ molecule });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener molécula';
    const status = message.toLowerCase().includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, props: RouteContext) {
  try {
    const { orgId, orgRole, userId } = await getServerAuthSession();

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
    const body = await request.json();
    const validated = UpdateAtomInputSchema.parse(body);

    let payloadPatch = { ...(validated.payload ?? {}) };
    const metadataPatch = { ...(validated.metadata ?? {}) };

    if (validated.rawText) {
      const parsed = OmnibarParser.extractTokens(validated.rawText);
      const cleanTitle = parsed.cleanText.trim() || validated.rawText.trim();
      payloadPatch = {
        ...payloadPatch,
        title: cleanTitle,
      };

      if (parsed.temporal) {
        payloadPatch.dueDate = parsed.temporal.date.toISOString();
        metadataPatch.due_date = parsed.temporal.date.toISOString();
        metadataPatch.has_time = parsed.temporal.hasTime;
        metadataPatch.raw_expression = parsed.temporal.expression;
      }

      for (const ent of parsed.entities) {
        const targetId = await OmnibarReactor.findOrCreateAtom(tenantContext, 'entity', ent.name);
        await SynapseRepository.createSynapse(tenantContext, {
          sourceAtomId: id,
          targetAtomId: targetId,
          relationType: 'ASSIGNED_TO',
          metadata: { rawToken: ent.raw },
        });
      }

      for (const ctx of parsed.contexts) {
        const targetId = await OmnibarReactor.findOrCreateAtom(tenantContext, 'context', ctx.name);
        await SynapseRepository.createSynapse(tenantContext, {
          sourceAtomId: id,
          targetAtomId: targetId,
          relationType: 'TAGGED_WITH',
          metadata: { rawToken: ctx.raw },
        });
      }
    }

    const updatedAtom = await MoleculeRepository.updateAtom(tenantContext, id, {
      payload: payloadPatch,
      metadata: metadataPatch,
    });

    return NextResponse.json({ atom: updatedAtom });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar átomo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: RouteContext) {
  try {
    const { orgId, orgRole, userId } = await getServerAuthSession();

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
    const success = await MoleculeRepository.deleteAtom(tenantContext, id);

    return NextResponse.json({ success });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar átomo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
