import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuthSession } from '@/libs/auth/server-auth';
import { resolveTenantContext } from '@/modules/codex/domain/security/tenantContext';
import { AccessDeniedError, IngestIntentSchema } from '@/modules/codex/domain/types';
import { OmnibarReactor } from '@/modules/codex/omnibar/reactor/OmnibarReactor';

const IngestRequestSchema = z
  .object({
    text: z.string().optional(),
    intent: IngestIntentSchema.optional(),
    organizationId: z.string().optional(),
  })
  .refine(data => data.text || data.intent, {
    message: 'Debe proporcionar al menos "text" o "intent"',
  });

export async function POST(req: Request) {
  try {
    const { orgId: currentOrgId, orgRole: currentOrgRole, userId } = await getServerAuthSession();

    if (!userId) {
      return NextResponse.json(
        { error: 'No autenticado: inicie sesión para usar la Omnibarra' },
        { status: 401 },
      );
    }

    const bodyJson = await req.json();
    const parsedBody = IngestRequestSchema.safeParse(bodyJson);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Parámetros inválidos',
          details: parsedBody.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { intent, organizationId: customOrgId, text } = parsedBody.data;
    const headerOrgId = req.headers.get('x-organization-id');
    const requestedOrgId = headerOrgId ?? customOrgId;

    const tenantContext = await resolveTenantContext(
      userId,
      currentOrgId,
      currentOrgRole,
      requestedOrgId,
    );

    // Ejecutar el reactor molecular
    const molecule = await OmnibarReactor.ingest(
      tenantContext,
      intent ?? text!,
    );

    return NextResponse.json(
      {
        success: true,
        molecule,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error interno en el reactor de ingesta',
      },
      { status: 500 },
    );
  }
}
