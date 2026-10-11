import type { Role, TenantContext } from '@/types/biology';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AccessDeniedError } from '@/libs/biology/AccessGuard';
import { db } from '@/libs/DB';
import { OmnibarReactor } from '@/libs/omnibar/OmnibarReactor';
import { membershipsSchema } from '@/models/Schema';
import { IngestIntentSchema } from '@/types/omnibar';

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
    const { orgId: clerkOrgId, orgRole: clerkOrgRole, userId } = await auth();

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

    // Resolver organización objetivo (prioridad: Clerk org activa > header > body > membresía)
    const headerOrgId = req.headers.get('x-organization-id');
    const targetOrgId = clerkOrgId ?? headerOrgId ?? customOrgId;

    if (!targetOrgId) {
      // Buscar primera organización a la que pertenece el usuario
      const [membership] = await db
        .select()
        .from(membershipsSchema)
        .where(eq(membershipsSchema.userId, userId))
        .limit(1);

      if (!membership) {
        return NextResponse.json(
          { error: 'El usuario no pertenece a ninguna organización activa' },
          { status: 400 },
        );
      }
    }

    const resolvedOrgId = targetOrgId
      ?? (
        await db
          .select({ orgId: membershipsSchema.organizationId })
          .from(membershipsSchema)
          .where(eq(membershipsSchema.userId, userId))
          .limit(1)
      )[0]?.orgId;

    if (!resolvedOrgId) {
      return NextResponse.json(
        { error: 'Organización no encontrada' },
        { status: 400 },
      );
    }

    // Determinar rol del usuario en esta organización
    let userRole: Role = 'member';

    const [dbMembership] = await db
      .select({ role: membershipsSchema.role })
      .from(membershipsSchema)
      .where(
        and(
          eq(membershipsSchema.organizationId, resolvedOrgId),
          eq(membershipsSchema.userId, userId),
        ),
      )
      .limit(1);

    if (dbMembership?.role) {
      userRole = dbMembership.role as Role;
    } else if (clerkOrgRole === 'org:admin') {
      userRole = 'admin';
    }

    const tenantContext: TenantContext = {
      organizationId: resolvedOrgId,
      userId,
      role: userRole,
    };

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
