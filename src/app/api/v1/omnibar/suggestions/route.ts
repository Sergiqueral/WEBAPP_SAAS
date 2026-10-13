import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { member, user } from '@/libs/auth/schema';
import { getServerAuthSession } from '@/libs/auth/server-auth';
import { db } from '@/libs/DB';
import { atomsSchema } from '@/modules/codex/db/schema';
import { resolveTenantContext } from '@/modules/codex/domain/security/tenantContext';

export async function GET(request: Request) {
  try {
    const { orgId: currentOrgId, orgRole: currentOrgRole, userId } = await getServerAuthSession();

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
      currentOrgId,
      currentOrgRole,
      requestedOrgId,
    );

    // Tipos biológicos de entidades
    const entityTypes = ['entity', 'client', 'contact', 'person', 'lead', 'provider', 'employee'];
    // Tipos biológicos de contextos
    const contextTypes = ['context', 'tag', 'project', 'topic', 'area'];

    // Consultas concurrentes: átomos locales en DB y miembros de la organización en PostgreSQL
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
        if (!tenantContext.organizationId) {
          return [];
        }
        try {
          const membersList = await db
            .select({
              id: member.id,
              userId: member.userId,
              name: user.name,
              email: user.email,
            })
            .from(member)
            .innerJoin(user, eq(member.userId, user.id))
            .where(eq(member.organizationId, tenantContext.organizationId))
            .limit(50);
          return membersList;
        } catch {
          return [];
        }
      })(),
    ]);

    // Combinar miembros con entidades existentes sin duplicados
    const seenNames = new Set<string>();
    const entities: Array<{ id: string; name: string }> = [];

    // Priorizar miembros activos del equipo
    for (const m of orgMemberships) {
      const name = m.name || m.email.split('@')[0] || 'Miembro';
      const lower = name.toLowerCase();

      if (!seenNames.has(lower)) {
        seenNames.add(lower);
        entities.push({
          id: `member-${m.userId}`,
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
