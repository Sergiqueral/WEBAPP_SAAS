import type { IngestIntent, MolecularProjection, TenantContext } from '@/modules/codex/domain/types';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { atomsSchema } from '@/modules/codex/db/schema';
import { AtomRepository } from '@/modules/codex/domain/repositories/AtomRepository';
import { SynapseRepository } from '@/modules/codex/domain/repositories/SynapseRepository';
import { AccessGuard } from '@/modules/codex/domain/security/AccessGuard';
import { IngestIntentSchema } from '@/modules/codex/domain/types';
import { OmnibarParser } from '@/modules/codex/omnibar/parser/OmnibarParser';

export type IngestOptions = {
  knownEntities?: Array<{ id: string; name: string }>;
  referenceDate?: Date;
};

export class OmnibarReactor {
  /**
   * Busca un átomo existente por tipo y nombre (case-insensitive) dentro del tenant.
   * Si no existe, lo sintetiza automáticamente.
   */
  static async findOrCreateAtom(
    context: TenantContext,
    type: string,
    name: string,
  ): Promise<string> {
    const normalizedType = type.trim().toLowerCase();
    const cleanName = name.trim();

    // 1. Buscar si ya existe un átomo con este nombre y tipo en el tenant
    const [existing] = await db
      .select({ id: atomsSchema.id })
      .from(atomsSchema)
      .where(
        and(
          eq(atomsSchema.organizationId, context.organizationId),
          eq(atomsSchema.type, normalizedType),
          sql`LOWER(${atomsSchema.payload}->>'name') = LOWER(${cleanName})`,
        ),
      )
      .limit(1);

    if (existing) {
      return existing.id;
    }

    // 2. Si no existe, sintetizarlo de inmediato
    const created = await AtomRepository.createAtom(context, {
      type: normalizedType,
      payload: {
        name: cleanName,
      },
      metadata: {
        auto_created: true,
        origin: 'omnibar_reactor',
      },
    });

    return created.id;
  }

  /**
   * Procesa la ingesta molecular:
   * 1. Valida permisos de escritura con AccessGuard (bloquea viewers).
   * 2. Si el input es un string, lo analiza con OmnibarParser.
   * 3. Resuelve o sintetiza las entidades (@) y contextos (#).
   * 4. Sintetiza el átomo central (task, note, inbox).
   * 5. Establece las sinapsis químicas con deduplicación.
   * 6. Devuelve la proyección molecular completa.
   */
  static async ingest(
    context: TenantContext,
    input: IngestIntent | string,
    options: IngestOptions = {},
  ): Promise<MolecularProjection> {
    // 1. Guardián de seguridad: Si el usuario es 'viewer', lanza AccessDeniedError
    AccessGuard.assertCanWrite(context);

    // 2. Normalizar input a IngestIntent
    const intent: IngestIntent = typeof input === 'string'
      ? OmnibarParser.parseToIntent(input, options)
      : IngestIntentSchema.parse(input);

    // 3. Resolver identificadores de sinapsis (@ y #)
    const resolvedTargets: Array<{
      targetAtomId: string;
      relationType: string;
      metadata: Record<string, unknown>;
    }> = [];

    // Conjunto para evitar crear dos veces el mismo enlace en la misma ingesta
    const seenSynapses = new Set<string>();

    for (const syn of intent.synapses) {
      let targetId = syn.targetAtomId;

      if (!targetId && syn.targetEntityName) {
        // Encontrar o crear átomo de entidad o contexto
        targetId = await this.findOrCreateAtom(
          context,
          syn.targetType,
          syn.targetEntityName,
        );
      }

      if (targetId) {
        const uniqueKey = `${targetId}:${syn.relationType}`;
        if (!seenSynapses.has(uniqueKey)) {
          seenSynapses.add(uniqueKey);
          resolvedTargets.push({
            targetAtomId: targetId,
            relationType: syn.relationType,
            metadata: syn.metadata ?? {},
          });
        }
      }
    }

    // 4. Sintetizar Átomo Central
    const coreMetadata: Record<string, unknown> = {
      ...intent.metadata,
      provenance: intent.source,
    };

    if (intent.temporal) {
      coreMetadata.due_date = intent.temporal.dueDate.toISOString();
      coreMetadata.has_time = intent.temporal.hasTime;
      coreMetadata.raw_expression = intent.temporal.rawExpression;
    }

    const coreAtom = await AtomRepository.createAtom(context, {
      type: intent.coreAtom.type,
      payload: {
        title: intent.coreAtom.title,
        ...(intent.coreAtom.content ? { content: intent.coreAtom.content } : {}),
        ...intent.coreAtom.payload,
      },
      metadata: coreMetadata,
    });

    // 5. Establecer Sinapsis
    for (const item of resolvedTargets) {
      await SynapseRepository.createSynapse(context, {
        sourceAtomId: coreAtom.id,
        targetAtomId: item.targetAtomId,
        relationType: item.relationType,
        metadata: item.metadata,
      });
    }

    // 6. Proyectar y retornar la molécula completa
    const molecule = await SynapseRepository.getMolecule(context, coreAtom.id);
    if (!molecule) {
      throw new Error('Error al proyectar la molécula resultante');
    }

    return molecule;
  }
}
