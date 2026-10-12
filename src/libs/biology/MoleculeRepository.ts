import type { GetMoleculesOptions, MolecularProjection, SynapseNeighbor, TenantContext } from '@/types/biology';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { AccessGuard } from '@/libs/biology/AccessGuard';
import { db } from '@/libs/DB';
import { atomExternalIdentitiesSchema, atomsSchema, linksSchema } from '@/models/Schema';
import { AtomExternalIdentitySchema, AtomSchema, LinkSchema } from '@/types/biology';
import { AtomRepository } from './AtomRepository';

export class MoleculeRepository {
  /**
   * Obtiene un conjunto de moléculas completas en lote (Batch Graph Query)
   * evitando consultas N+1 al agrupar enlaces y átomos vecinos.
   */
  static async getMolecules(
    context: TenantContext,
    options: GetMoleculesOptions = {},
  ): Promise<MolecularProjection[]> {
    const {
      limit = 50,
      offset = 0,
      status = 'all',
      targetAtomId,
      type = 'all',
    } = options;

    // 1. Filtrado de grafo: Si se solicita átomos conectados a una entidad/contexto específico
    let connectedAtomIds: string[] | null = null;
    if (targetAtomId) {
      const links = await db
        .select()
        .from(linksSchema)
        .where(
          and(
            eq(linksSchema.organizationId, context.organizationId),
            or(
              eq(linksSchema.sourceAtomId, targetAtomId),
              eq(linksSchema.targetAtomId, targetAtomId),
            ),
          ),
        );

      connectedAtomIds = links.map(link =>
        link.sourceAtomId === targetAtomId ? link.targetAtomId : link.sourceAtomId,
      );

      // Si no hay enlaces conectados a ese nodo, no hay moléculas resultantes
      if (connectedAtomIds.length === 0) {
        return [];
      }
    }

    // 2. Construir condiciones para los átomos raíz
    const conditions = [eq(atomsSchema.organizationId, context.organizationId)];

    if (connectedAtomIds !== null) {
      conditions.push(inArray(atomsSchema.id, connectedAtomIds));
    }

    if (type !== 'all') {
      conditions.push(eq(atomsSchema.type, type.toLowerCase()));
    } else {
      // Por defecto el feed principal muestra tareas, notas e inbox
      conditions.push(inArray(atomsSchema.type, ['task', 'note', 'inbox']));
    }

    if (status !== 'all') {
      if (status === 'pending') {
        conditions.push(
          sql`COALESCE(${atomsSchema.payload}->>'status', 'pending') != 'done'`,
        );
      } else if (status === 'in_progress') {
        conditions.push(
          sql`${atomsSchema.payload}->>'status' = 'in_progress'`,
        );
      } else if (status === 'done') {
        conditions.push(
          sql`${atomsSchema.payload}->>'status' = 'done'`,
        );
      }
    }

    // 3. Obtener átomos raíz
    const rootRecords = await db
      .select()
      .from(atomsSchema)
      .where(and(...conditions))
      .orderBy(desc(atomsSchema.createdAt))
      .limit(limit)
      .offset(offset);

    const rootAtoms = rootRecords
      .map(r => AtomSchema.parse(r))
      .filter(atom => AccessGuard.canReadAtom(context, atom));

    if (rootAtoms.length === 0) {
      return [];
    }

    const rootIds = rootAtoms.map(a => a.id);

    // 4. Batch Query 1: Obtener todos los enlaces salientes y entrantes de los átomos raíz
    const linksRecords = await db
      .select()
      .from(linksSchema)
      .where(
        and(
          eq(linksSchema.organizationId, context.organizationId),
          or(
            inArray(linksSchema.sourceAtomId, rootIds),
            inArray(linksSchema.targetAtomId, rootIds),
          ),
        ),
      );

    const links = linksRecords.map(l => LinkSchema.parse(l));

    // 5. Batch Query 2: Obtener todos los átomos vecinos enlazados que no sean los propios raíz
    const neighborAtomIdsSet = new Set<string>();
    for (const link of links) {
      if (!rootIds.includes(link.sourceAtomId)) {
        neighborAtomIdsSet.add(link.sourceAtomId);
      }
      if (!rootIds.includes(link.targetAtomId)) {
        neighborAtomIdsSet.add(link.targetAtomId);
      }
    }

    const neighborAtomIds = Array.from(neighborAtomIdsSet);
    const neighborMap = new Map<string, typeof rootAtoms[number]>();

    // Indexar los propios raíces primero en el mapa
    for (const root of rootAtoms) {
      neighborMap.set(root.id, root);
    }

    if (neighborAtomIds.length > 0) {
      const neighborRecords = await db
        .select()
        .from(atomsSchema)
        .where(
          and(
            eq(atomsSchema.organizationId, context.organizationId),
            inArray(atomsSchema.id, neighborAtomIds),
          ),
        );

      for (const rec of neighborRecords) {
        const atom = AtomSchema.parse(rec);
        if (AccessGuard.canReadAtom(context, atom)) {
          neighborMap.set(atom.id, atom);
        }
      }
    }

    // 6. Batch Query 3: Obtener identidades externas para los átomos raíz
    const externalRecords = await db
      .select()
      .from(atomExternalIdentitiesSchema)
      .where(
        and(
          eq(atomExternalIdentitiesSchema.organizationId, context.organizationId),
          inArray(atomExternalIdentitiesSchema.atomId, rootIds),
        ),
      );

    const externalIdentities = externalRecords.map(e => AtomExternalIdentitySchema.parse(e));

    // 7. Ensamblar las proyecciones moleculares
    const molecules: MolecularProjection[] = [];

    for (const root of rootAtoms) {
      const outgoing: SynapseNeighbor[] = [];
      const incoming: SynapseNeighbor[] = [];

      for (const link of links) {
        if (link.sourceAtomId === root.id) {
          const target = neighborMap.get(link.targetAtomId);
          if (target) {
            outgoing.push({
              linkId: link.id,
              relationType: link.relationType,
              metadata: link.metadata,
              atom: target,
            });
          }
        }

        if (link.targetAtomId === root.id) {
          const source = neighborMap.get(link.sourceAtomId);
          if (source) {
            incoming.push({
              linkId: link.id,
              relationType: link.relationType,
              metadata: link.metadata,
              atom: source,
            });
          }
        }
      }

      const atomExternals = externalIdentities.filter(e => e.atomId === root.id);

      molecules.push({
        root,
        outgoing,
        incoming,
        externalIdentities: atomExternals,
      });
    }

    return molecules;
  }

  /**
   * Actualiza el contenido (payload o metadata) de un átomo.
   */
  static async updateAtom(
    context: TenantContext,
    atomId: string,
    patch: {
      payload?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ) {
    return AtomRepository.updateAtom(context, atomId, patch);
  }

  /**
   * Elimina un átomo y sus sinapsis en cascada.
   */
  static async deleteAtom(context: TenantContext, atomId: string) {
    return AtomRepository.deleteAtom(context, atomId);
  }
}
