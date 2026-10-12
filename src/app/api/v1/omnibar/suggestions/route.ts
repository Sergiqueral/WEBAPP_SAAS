import { auth, clerkClient } from '@clerk/nextjs/server';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { atomsSchema } from '@/modules/codex/db/schema';
import { resolveTenantContext } from '@/modules/codex/domain/security/tenantContext';

export async function GET(request: Request) {
  try {
    const { orgId: clerkOrgId, orgRole: clerkOrgRole, userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizationId');

    const tenantContext = await resolveTenantContext(
      userId,
      clerkOrgId,
      clerkOrgRole,
      requestedOrgId,
    );

    // Tipos biológicos de entidades
    const entityTypes = ['entity', 'client', 'contact', 'person', 'lead', 'provider', 'employee'];
    // Tipos biológicos de contextos
    const contextTypes = ['context', 'tag', 'project', 'topic', 'area'];

    // Consultas concurrentes: átomos locales en DB y miembros de la organización en Clerk
    const [rawEntities, rawContexts, orgMemberships] = await Promise.all([
      db.query.atomsSchema.findMany({
        where: and(
          eq(atomsSchema.organizationId, tenantContext.organizationId),
          inArray(atomsSchema.type, entityTypes),
        ),
        limit: 100,
      }),
      db.query.atomsSchema.findMany({
        where: and(
          eq(atomsSchema.organizationId, tenantContext.organizationId),
          inArray(atomsSchema.type, contextTypes),
        ),
        limit: 100,
      }),
      (async () => {
        if (!clerkOrgId) {
          return [];
        }
        try {
          const client = await clerkClient();
          const res = await client.organizations.getOrganizationMembershipList({
            organizationId: clerkOrgId,
            limit: 50,
          });
          return res.data;
        } catch {
          return [];
        }
      })(),
    ]);

    // Combinar miembros de Clerk con entidades existentes sin duplicados
    const seenNames = new Set<string>();
    const entities: Array<{ id: string; name: string }> = [];

    // Priorizar miembros activos del equipo
    for (const membership of orgMemberships) {
      const u = membership.publicUserData;
      const fullName = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
      const identifier = u?.identifier?.split('@')[0] ?? '';
      const name = fullName || identifier || 'Miembro';
      const lower = name.toLowerCase();

      if (!seenNames.has(lower)) {
        seenNames.add(lower);
        entities.push({
          id: `clerk-member-${u?.userId ?? membership.id}`,
          name,
        });
      }
    }

    // Agregar entidades guardadas en la base de datos
    for (const atom of rawEntities) {
      const name = String(atom.payload.name ?? atom.payload.title ?? 'Sin nombre');
      const lower = name.toLowerCase();

      if (!seenNames.has(lower)) {
        seenNames.add(lower);
        entities.push({
          id: atom.id,
          name,
        });
      }
    }

    const contexts = rawContexts.map(atom => ({
      id: atom.id,
      name: String(atom.payload.name ?? atom.payload.title ?? 'Sin nombre'),
    }));

    return NextResponse.json({ entities, contexts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
