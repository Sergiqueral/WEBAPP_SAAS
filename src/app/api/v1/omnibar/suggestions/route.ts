import { auth } from '@clerk/nextjs/server';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { atomsSchema, membershipsSchema } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const { orgId: clerkOrgId, userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizationId');
    let targetOrgId = clerkOrgId ?? requestedOrgId;

    if (!targetOrgId) {
      const userMembership = await db.query.membershipsSchema.findFirst({
        where: eq(membershipsSchema.userId, userId),
      });

      if (userMembership) {
        targetOrgId = userMembership.organizationId;
      }
    }

    if (!targetOrgId) {
      return NextResponse.json({ entities: [], contexts: [] });
    }

    // Tipos biológicos de entidades
    const entityTypes = ['entity', 'client', 'contact', 'person', 'lead', 'provider', 'employee'];
    // Tipos biológicos de contextos
    const contextTypes = ['context', 'tag', 'project', 'topic', 'area'];

    const [rawEntities, rawContexts] = await Promise.all([
      db.query.atomsSchema.findMany({
        where: and(
          eq(atomsSchema.organizationId, targetOrgId),
          inArray(atomsSchema.type, entityTypes),
        ),
        limit: 100,
      }),
      db.query.atomsSchema.findMany({
        where: and(
          eq(atomsSchema.organizationId, targetOrgId),
          inArray(atomsSchema.type, contextTypes),
        ),
        limit: 100,
      }),
    ]);

    const entities = rawEntities.map(atom => ({
      id: atom.id,
      name: String(atom.payload.name ?? atom.payload.title ?? 'Sin nombre'),
    }));

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
