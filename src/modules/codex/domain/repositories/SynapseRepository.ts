import type {
  AtomExternalIdentity,
  Link,
  MolecularProjection,
  SynapseInput,
  SynapseNeighbor,
  TenantContext,
} from '@/modules/codex/domain/types';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { atomExternalIdentitiesSchema, atomsSchema, linksSchema } from '@/modules/codex/db/schema';
import { AccessGuard } from '@/modules/codex/domain/security/AccessGuard';
import {
  AtomExternalIdentitySchema,
  AtomSchema,
  LinkSchema,
  SynapseInputSchema,
} from '@/modules/codex/domain/types';
import { AtomRepository } from './AtomRepository';

export class SynapseRepository {
  /**
   * Crea un enlace químico (sinapsis) entre dos átomos dentro de la misma organización.
   * Valida permisos y previene contaminación cruzada de tenants.
   */
  static async createSynapse(
    context: TenantContext,
    input: SynapseInput,
  ): Promise<Link> {
    AccessGuard.assertCanWrite(context);

    const validated = SynapseInputSchema.parse(input);

    // Verificación de integridad: Ambos átomos deben pertenecer a la misma organización
    const [sourceAtom, targetAtom] = await Promise.all([
      AtomRepository.getAtomById(context, validated.sourceAtomId),
      AtomRepository.getAtomById(context, validated.targetAtomId),
    ]);

    if (!sourceAtom || !targetAtom) {
      throw new Error(
        'No se puede crear la sinapsis: uno o ambos átomos no existen en esta organización.',
      );
    }

    const [inserted] = await db
      .insert(linksSchema)
      .values({
        organizationId: context.organizationId,
        sourceAtomId: validated.sourceAtomId,
        targetAtomId: validated.targetAtomId,
        relationType: validated.relationType,
        metadata: validated.metadata,
      })
      .returning();

    if (!inserted) {
      throw new Error('Error al establecer la sinapsis');
    }

    return LinkSchema.parse(inserted);
  }

  /**
   * Elimina una sinapsis existente.
   */
  static async deleteSynapse(
    context: TenantContext,
    linkId: string,
  ): Promise<boolean> {
    AccessGuard.assertCanWrite(context);

    const result = await db
      .delete(linksSchema)
      .where(
        and(
          eq(linksSchema.id, linkId),
          eq(linksSchema.organizationId, context.organizationId),
        ),
      )
      .returning({ id: linksSchema.id });

    return result.length > 0;
  }

  /**
   * Reconstruye la molécula completa de primer nivel para un átomo raíz:
   * Trae el átomo raíz, todas sus sinapsis salientes, entrantes y sus identidades externas.
   */
  static async getMolecule(
    context: TenantContext,
    rootAtomId: string,
  ): Promise<MolecularProjection> {
    const rootAtom = await AtomRepository.getAtomById(context, rootAtomId);
    if (!rootAtom) {
      throw new Error('Átomo raíz molecular no encontrado');
    }

    // 1. Obtener sinapsis salientes y entrantes en paralelo
    const [outgoingLinks, incomingLinks, externalIdRecords] = await Promise.all([
      db
        .select()
        .from(linksSchema)
        .where(
          and(
            eq(linksSchema.organizationId, context.organizationId),
            eq(linksSchema.sourceAtomId, rootAtomId),
          ),
        ),
      db
        .select()
        .from(linksSchema)
        .where(
          and(
            eq(linksSchema.organizationId, context.organizationId),
            eq(linksSchema.targetAtomId, rootAtomId),
          ),
        ),
      db
        .select()
        .from(atomExternalIdentitiesSchema)
        .where(
          and(
            eq(atomExternalIdentitiesSchema.organizationId, context.organizationId),
            eq(atomExternalIdentitiesSchema.atomId, rootAtomId),
          ),
        ),
    ]);

    // 2. Extraer todos los IDs de átomos vecinos conectados
    const neighborAtomIds = Array.from(
      new Set([
        ...outgoingLinks.map(l => l.targetAtomId),
        ...incomingLinks.map(l => l.sourceAtomId),
      ]),
    );

    let neighborAtomsMap = new Map<string, ReturnType<typeof AtomSchema.parse>>();

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

      neighborAtomsMap = new Map(
        neighborRecords.map(r => [r.id, AtomSchema.parse(r)]),
      );
    }

    // 3. Proyectar vecinos respetando permisos de lectura
    const outgoing: SynapseNeighbor[] = [];
    for (const link of outgoingLinks) {
      const targetAtom = neighborAtomsMap.get(link.targetAtomId);
      if (targetAtom && AccessGuard.canReadAtom(context, targetAtom)) {
        outgoing.push({
          linkId: link.id,
          relationType: link.relationType,
          metadata: (link.metadata as Record<string, unknown>) ?? {},
          atom: targetAtom,
        });
      }
    }

    const incoming: SynapseNeighbor[] = [];
    for (const link of incomingLinks) {
      const sourceAtom = neighborAtomsMap.get(link.sourceAtomId);
      if (sourceAtom && AccessGuard.canReadAtom(context, sourceAtom)) {
        incoming.push({
          linkId: link.id,
          relationType: link.relationType,
          metadata: (link.metadata as Record<string, unknown>) ?? {},
          atom: sourceAtom,
        });
      }
    }

    const externalIdentities: AtomExternalIdentity[] = externalIdRecords.map(r =>
      AtomExternalIdentitySchema.parse(r),
    );

    return {
      root: rootAtom,
      outgoing,
      incoming,
      externalIdentities,
    };
  }
}
