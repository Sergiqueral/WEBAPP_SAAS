import type {
  Atom,
  IngestIntent,
  MolecularProjection,
  ParsedSyntagmaChunk,
  TenantContext,
} from '@/modules/codex/domain/types';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { atomsSchema, linksSchema } from '@/modules/codex/db/schema';
import { AtomRepository } from '@/modules/codex/domain/repositories/AtomRepository';
import { SynapseRepository } from '@/modules/codex/domain/repositories/SynapseRepository';
import { AccessGuard } from '@/modules/codex/domain/security/AccessGuard';
import { AtomSchema, IngestIntentSchema } from '@/modules/codex/domain/types';
import { OmnibarParser } from '@/modules/codex/omnibar/parser/OmnibarParser';

export type IngestOptions = {
  knownEntities?: Array<{ id: string; name: string }>;
  referenceDate?: Date;
};

export type ResolvedIdentityResult = {
  clientAtom: Atom | null;
  isAmbiguous: boolean;
  candidateAtomIds: string[];
  matchType:
    | 'hard_phone'
    | 'hard_email'
    | 'hard_document'
    | 'soft_unique'
    | 'soft_ambiguous'
    | 'auto_synthesized'
    | 'exact_name_new_contact'
    | 'none';
  matchedValue?: string;
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
   * Resolución de Identidad Molecular:
   * 1. Hard Anchors (Únicos): Teléfonos, Emails, DNI/NIE/CIF válidos.
   * 2. Soft Anchors (Reutilizables/Homónimos): Nombres de personas o empresas.
   *    - Si hay 1 coincidencia exacta -> Vincula.
   *    - Si hay múltiples coincidencias -> Alerta de ambigüedad (no asume a ciegas).
   */
  static async resolveExistingIdentity(
    context: TenantContext,
    params: {
      phones?: string[];
      emails?: string[];
      documents?: string[];
      names?: string[];
    },
  ): Promise<ResolvedIdentityResult> {
    const { phones = [], emails = [], documents = [], names = [] } = params;

    // A) HARD ANCHORS: Teléfonos
    for (const phone of phones) {
      // 1. En payload de cliente/contacto
      const [direct] = await db
        .select()
        .from(atomsSchema)
        .where(
          and(
            eq(atomsSchema.organizationId, context.organizationId),
            inArray(atomsSchema.type, ['client', 'contact']),
            sql`(
              ${atomsSchema.payload} @> ${JSON.stringify({ phones: [phone] })}::jsonb
              OR ${atomsSchema.payload}->>'phone' = ${phone}
              OR ${atomsSchema.payload}->>'name' = ${phone}
            )`,
          ),
        )
        .limit(1);

      if (direct) {
        return {
          clientAtom: AtomSchema.parse(direct),
          isAmbiguous: false,
          candidateAtomIds: [],
          matchType: 'hard_phone',
          matchedValue: phone,
        };
      }

      // 2. Enlace a anchor_phone
      const [anchorLink] = await db
        .select({ client: atomsSchema })
        .from(linksSchema)
        .innerJoin(atomsSchema, eq(atomsSchema.id, linksSchema.sourceAtomId))
        .where(
          and(
            eq(linksSchema.organizationId, context.organizationId),
            eq(linksSchema.relationType, 'HAS_PHONE'),
            inArray(atomsSchema.type, ['client', 'contact']),
            sql`EXISTS (
              SELECT 1 FROM ${atomsSchema} a_anchor
              WHERE a_anchor.id = ${linksSchema.targetAtomId}
                AND a_anchor.organization_id = ${context.organizationId}
                AND a_anchor.type = 'anchor_phone'
                AND LOWER(a_anchor.payload->>'name') = LOWER(${phone})
            )`,
          ),
        )
        .limit(1);

      if (anchorLink) {
        return {
          clientAtom: AtomSchema.parse(anchorLink.client),
          isAmbiguous: false,
          candidateAtomIds: [],
          matchType: 'hard_phone',
          matchedValue: phone,
        };
      }
    }

    // B) HARD ANCHORS: Emails
    for (const email of emails) {
      const [direct] = await db
        .select()
        .from(atomsSchema)
        .where(
          and(
            eq(atomsSchema.organizationId, context.organizationId),
            inArray(atomsSchema.type, ['client', 'contact']),
            sql`(
              ${atomsSchema.payload} @> ${JSON.stringify({ emails: [email] })}::jsonb
              OR LOWER(${atomsSchema.payload}->>'email') = LOWER(${email})
            )`,
          ),
        )
        .limit(1);

      if (direct) {
        return {
          clientAtom: AtomSchema.parse(direct),
          isAmbiguous: false,
          candidateAtomIds: [],
          matchType: 'hard_email',
          matchedValue: email,
        };
      }

      const [anchorLink] = await db
        .select({ client: atomsSchema })
        .from(linksSchema)
        .innerJoin(atomsSchema, eq(atomsSchema.id, linksSchema.sourceAtomId))
        .where(
          and(
            eq(linksSchema.organizationId, context.organizationId),
            eq(linksSchema.relationType, 'HAS_EMAIL'),
            inArray(atomsSchema.type, ['client', 'contact']),
            sql`EXISTS (
              SELECT 1 FROM ${atomsSchema} a_anchor
              WHERE a_anchor.id = ${linksSchema.targetAtomId}
                AND a_anchor.organization_id = ${context.organizationId}
                AND a_anchor.type = 'anchor_email'
                AND LOWER(a_anchor.payload->>'name') = LOWER(${email})
            )`,
          ),
        )
        .limit(1);

      if (anchorLink) {
        return {
          clientAtom: AtomSchema.parse(anchorLink.client),
          isAmbiguous: false,
          candidateAtomIds: [],
          matchType: 'hard_email',
          matchedValue: email,
        };
      }
    }

    // C) HARD ANCHORS: Documentos de Identidad Fiscal (DNI, NIE, CIF)
    for (const doc of documents) {
      const [direct] = await db
        .select()
        .from(atomsSchema)
        .where(
          and(
            eq(atomsSchema.organizationId, context.organizationId),
            inArray(atomsSchema.type, ['client', 'contact']),
            sql`(
              ${atomsSchema.payload} @> ${JSON.stringify({ documents: [doc] })}::jsonb
              OR UPPER(${atomsSchema.payload}->>'document') = UPPER(${doc})
              OR UPPER(${atomsSchema.payload}->>'dni') = UPPER(${doc})
              OR UPPER(${atomsSchema.payload}->>'cif') = UPPER(${doc})
              OR UPPER(${atomsSchema.payload}->>'nie') = UPPER(${doc})
              OR UPPER(${atomsSchema.payload}->>'nif') = UPPER(${doc})
            )`,
          ),
        )
        .limit(1);

      if (direct) {
        return {
          clientAtom: AtomSchema.parse(direct),
          isAmbiguous: false,
          candidateAtomIds: [],
          matchType: 'hard_document',
          matchedValue: doc,
        };
      }

      const [anchorLink] = await db
        .select({ client: atomsSchema })
        .from(linksSchema)
        .innerJoin(atomsSchema, eq(atomsSchema.id, linksSchema.sourceAtomId))
        .where(
          and(
            eq(linksSchema.organizationId, context.organizationId),
            eq(linksSchema.relationType, 'HAS_DOCUMENT'),
            inArray(atomsSchema.type, ['client', 'contact']),
            sql`EXISTS (
              SELECT 1 FROM ${atomsSchema} a_anchor
              WHERE a_anchor.id = ${linksSchema.targetAtomId}
                AND a_anchor.organization_id = ${context.organizationId}
                AND a_anchor.type = 'anchor_document'
                AND UPPER(a_anchor.payload->>'name') = UPPER(${doc})
            )`,
          ),
        )
        .limit(1);

      if (anchorLink) {
        return {
          clientAtom: AtomSchema.parse(anchorLink.client),
          isAmbiguous: false,
          candidateAtomIds: [],
          matchType: 'hard_document',
          matchedValue: doc,
        };
      }
    }

    // D) SOFT ANCHORS: Nombres Propios (con detección de homónimos)
    for (const name of names) {
      const cleanName = name.trim();
      if (!cleanName) {
        continue;
      }

      const candidates = await db
        .select()
        .from(atomsSchema)
        .where(
          and(
            eq(atomsSchema.organizationId, context.organizationId),
            inArray(atomsSchema.type, ['client', 'contact']),
            sql`(
              LOWER(${atomsSchema.payload}->>'name') = LOWER(${cleanName})
              OR LOWER(${atomsSchema.payload}->>'title') = LOWER(${cleanName})
            )`,
          ),
        )
        .limit(10);

      if (candidates.length === 1 && candidates[0]) {
        return {
          clientAtom: AtomSchema.parse(candidates[0]),
          isAmbiguous: false,
          candidateAtomIds: [],
          matchType: 'soft_unique',
          matchedValue: cleanName,
        };
      } else if (candidates.length > 1) {
        return {
          clientAtom: null,
          isAmbiguous: true,
          candidateAtomIds: candidates.map(c => c.id),
          matchType: 'soft_ambiguous',
          matchedValue: cleanName,
        };
      }
    }

    return {
      clientAtom: null,
      isAmbiguous: false,
      candidateAtomIds: [],
      matchType: 'none',
    };
  }

  /**
   * Procesa la ingesta molecular:
   * 1. Valida permisos de escritura con AccessGuard (bloquea viewers).
   * 2. Si el input es un string, lo analiza con OmnibarParser.
   * 3. Ejecuta la Resolución de Identidad (Hard/Soft Anchors).
   * 4. Sintetiza o enriquece el átomo central (task, client, note, inbox).
   * 5. Establece las sinapsis químicas con bidireccionalidad.
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

    // 3. Resolución de Identidad en BD
    const phones = (intent.coreAtom.payload.phones as string[]) ?? [];
    const emails = (intent.coreAtom.payload.emails as string[]) ?? [];
    const documents = (intent.coreAtom.payload.documents as string[]) ?? [];
    const names = intent.synapses
      .filter(s => s.relationType === 'ASSIGNED_TO' && s.targetEntityName)
      .map(s => s.targetEntityName!);

    const identityResolution = await this.resolveExistingIdentity(context, {
      phones,
      emails,
      documents,
      names,
    });

    // CASO ESPECIAL: Si la entrada es un arquetipo 'client' y ya existe dicho cliente, enriquecerlo sin duplicar
    if (intent.coreAtom.type === 'client' && identityResolution.clientAtom) {
      const existingClient = identityResolution.clientAtom;
      const existingPayload = (existingClient.payload as Record<string, unknown>) ?? {};

      const mergedPhones = Array.from(new Set([
        ...((existingPayload.phones as string[]) ?? []),
        ...(existingPayload.phone ? [existingPayload.phone as string] : []),
        ...phones,
      ]));
      const mergedEmails = Array.from(new Set([
        ...((existingPayload.emails as string[]) ?? []),
        ...(existingPayload.email ? [existingPayload.email as string] : []),
        ...emails,
      ]));
      const mergedDocs = Array.from(new Set([
        ...((existingPayload.documents as string[]) ?? []),
        ...documents,
      ]));
      const existingLocs = ((existingPayload.locations as Array<{ normalized?: string } | string>) ?? []);
      const incomingLocs = ((intent.coreAtom.payload.locations as Array<{ normalized?: string } | string>) ?? []);
      const mergedLocations = [
        ...existingLocs,
        ...incomingLocs.filter((nl) => {
          const nlNorm = typeof nl === 'string' ? nl : nl.normalized;
          return !existingLocs.some(el => (typeof el === 'string' ? el : el.normalized) === nlNorm);
        }),
      ];

      const updated = await AtomRepository.updateAtom(context, existingClient.id, {
        payload: {
          ...existingPayload,
          ...(intent.coreAtom.title && intent.coreAtom.title !== 'inbox'
            ? { name: intent.coreAtom.title }
            : {}),
          phones: mergedPhones,
          emails: mergedEmails,
          documents: mergedDocs,
          locations: mergedLocations,
        },
        metadata: {
          ...((existingClient.metadata as Record<string, unknown>) ?? {}),
          last_enriched_at: new Date().toISOString(),
          enriched_by_omnibar: true,
        },
      });

      // Conectar sinapsis pendientes
      for (const syn of intent.synapses) {
        let targetId = syn.targetAtomId;
        if (!targetId && syn.targetEntityName) {
          targetId = await this.findOrCreateAtom(context, syn.targetType, syn.targetEntityName);
        }
        if (targetId && targetId !== updated.id) {
          try {
            await SynapseRepository.createSynapse(context, {
              sourceAtomId: updated.id,
              targetAtomId: targetId,
              relationType: syn.relationType,
              metadata: syn.metadata ?? {},
            });
          } catch {
            // Ignorar duplicados
          }
        }
      }

      return SynapseRepository.getMolecule(context, updated.id);
    }

    // CASO ESPECIAL: Si la entrada es un evento o tarea con datos de cliente (nombre + teléfono/dirección/contacto)
    if (intent.coreAtom.type !== 'client') {
      if (identityResolution.clientAtom) {
        // Enriquecer cliente existente si trae nuevos teléfonos, emails o direcciones
        const existingClient = identityResolution.clientAtom;
        const existingPayload = (existingClient.payload as Record<string, unknown>) ?? {};
        const currentPhones = ((existingPayload.phones as string[]) ?? []);
        const currentEmails = ((existingPayload.emails as string[]) ?? []);
        const currentDocs = ((existingPayload.documents as string[]) ?? []);
        const currentLocs = ((existingPayload.locations as Array<{ normalized?: string } | string>) ?? []);
        const newPhones = phones.filter(p => !currentPhones.includes(p));
        const newEmails = emails.filter(e => !currentEmails.includes(e));
        const newDocs = documents.filter(d => !currentDocs.includes(d));
        const eventLocs = ((intent.coreAtom.payload.locations as Array<{ normalized?: string } | string>) ?? []);
        const newLocs = eventLocs.filter((el) => {
          const elNorm = typeof el === 'string' ? el : el.normalized;
          return !currentLocs.some(cl => (typeof cl === 'string' ? cl : cl.normalized) === elNorm);
        });

        if (newPhones.length > 0 || newEmails.length > 0 || newDocs.length > 0 || newLocs.length > 0) {
          const updatedClient = await AtomRepository.updateAtom(context, existingClient.id, {
            payload: {
              ...existingPayload,
              phones: [...currentPhones, ...newPhones],
              emails: [...currentEmails, ...newEmails],
              documents: [...currentDocs, ...newDocs],
              locations: [...currentLocs, ...newLocs],
            },
            metadata: {
              ...((existingClient.metadata as Record<string, unknown>) ?? {}),
              last_enriched_at: new Date().toISOString(),
              enriched_by_event: true,
            },
          });
          identityResolution.clientAtom = updatedClient;
        }
      } else {
        // Si el cliente no existe pero la entrada incluye un nombre propio con teléfono, email o ubicación, sintetizar cliente
        // siempre que no haya ambigüedad previa de homónimos
        const candidateName
          = names[0]
            ?? ((intent.coreAtom.payload.chunks as ParsedSyntagmaChunk[]) ?? []).find(
              c => c.type === 'entity',
            )?.cleanText;
        const hasContactData
          = phones.length > 0
            || emails.length > 0
            || documents.length > 0
            || ((intent.coreAtom.payload.locations as unknown[]) ?? []).length > 0;

        if (candidateName && hasContactData && !identityResolution.isAmbiguous) {
          const createdClient = await AtomRepository.createAtom(context, {
            type: 'client',
            payload: {
              name: candidateName,
              phones,
              emails,
              documents,
              locations: (intent.coreAtom.payload.locations as unknown[]) ?? [],
            },
            metadata: {
              provenance: 'omnibar_auto_synthesis',
              synthesized_from_event: true,
              created_at: new Date().toISOString(),
            },
          });
          identityResolution.clientAtom = createdClient;
          identityResolution.matchType = 'exact_name_new_contact';
        }
      }

      // Si tenemos cliente (existente o sintetizado), asegurar sinapsis de teléfono, email, documento y ubicación en el cliente
      if (identityResolution.clientAtom) {
        const clientId = identityResolution.clientAtom.id;

        // Conectar teléfonos al cliente con HAS_PHONE
        for (const phone of phones) {
          const phoneAtomId = await this.findOrCreateAtom(context, 'anchor_phone', phone);
          if (phoneAtomId && phoneAtomId !== clientId) {
            try {
              await SynapseRepository.createSynapse(context, {
                sourceAtomId: clientId,
                targetAtomId: phoneAtomId,
                relationType: 'HAS_PHONE',
                metadata: { auto_synthesized: true },
              });
            } catch {
              // Ignorar duplicados
            }
          }
        }

        // Conectar emails al cliente con HAS_EMAIL
        for (const email of emails) {
          const emailAtomId = await this.findOrCreateAtom(context, 'anchor_email', email);
          if (emailAtomId && emailAtomId !== clientId) {
            try {
              await SynapseRepository.createSynapse(context, {
                sourceAtomId: clientId,
                targetAtomId: emailAtomId,
                relationType: 'HAS_EMAIL',
                metadata: { auto_synthesized: true },
              });
            } catch {
              // Ignorar duplicados
            }
          }
        }

        // Conectar documentos al cliente con HAS_DOCUMENT
        for (const doc of documents) {
          const docAtomId = await this.findOrCreateAtom(context, 'anchor_document', doc);
          if (docAtomId && docAtomId !== clientId) {
            try {
              await SynapseRepository.createSynapse(context, {
                sourceAtomId: clientId,
                targetAtomId: docAtomId,
                relationType: 'HAS_DOCUMENT',
                metadata: { auto_synthesized: true },
              });
            } catch {
              // Ignorar duplicados
            }
          }
        }

        // Conectar ubicaciones al cliente con AT_LOCATION
        const locSynapses = intent.synapses.filter(s => s.relationType === 'AT_LOCATION');
        for (const locSyn of locSynapses) {
          let locTargetId = locSyn.targetAtomId;
          if (!locTargetId && locSyn.targetEntityName) {
            locTargetId = await this.findOrCreateAtom(
              context,
              locSyn.targetType,
              locSyn.targetEntityName,
            );
          }
          if (locTargetId && locTargetId !== clientId) {
            try {
              await SynapseRepository.createSynapse(context, {
                sourceAtomId: clientId,
                targetAtomId: locTargetId,
                relationType: 'AT_LOCATION',
                metadata: { ...locSyn.metadata, linked_from_event: true },
              });
            } catch {
              // Ignorar duplicados
            }
          }
        }
      }
    }

    // 4. Resolver identificadores de sinapsis (@ y #)
    const resolvedTargets: Array<{
      targetAtomId: string;
      relationType: string;
      metadata: Record<string, unknown>;
    }> = [];

    const seenSynapses = new Set<string>();

    for (const syn of intent.synapses) {
      let targetId = syn.targetAtomId;

      // Si la sinapsis es ASSIGNED_TO y resolvimos un cliente existente único, conectar directamente al cliente
      if (
        !targetId
        && syn.relationType === 'ASSIGNED_TO'
        && identityResolution.clientAtom
      ) {
        targetId = identityResolution.clientAtom.id;
      } else if (!targetId && syn.targetEntityName) {
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

    // 5. Sintetizar Átomo Central
    const coreMetadata: Record<string, unknown> = {
      ...intent.metadata,
      provenance: intent.source,
    };

    if (intent.temporal) {
      coreMetadata.due_date = intent.temporal.dueDate.toISOString();
      coreMetadata.has_time = intent.temporal.hasTime;
      coreMetadata.raw_expression = intent.temporal.rawExpression;
    }

    if (identityResolution.isAmbiguous) {
      coreMetadata.identity_ambiguity = {
        isAmbiguous: true,
        candidateAtomIds: identityResolution.candidateAtomIds,
        reason: identityResolution.matchType,
        matchedValue: identityResolution.matchedValue,
      };
    }

    const coreAtomPayload: Record<string, unknown> = {
      title: intent.coreAtom.title,
      ...(intent.coreAtom.content ? { content: intent.coreAtom.content } : {}),
      ...(intent.temporal ? { dueDate: intent.temporal.dueDate.toISOString() } : {}),
      ...intent.coreAtom.payload,
    };

    if (intent.coreAtom.type === 'client') {
      coreAtomPayload.name = intent.coreAtom.title;
    }

    const coreAtom = await AtomRepository.createAtom(context, {
      type: intent.coreAtom.type,
      payload: coreAtomPayload,
      metadata: coreMetadata,
    });

    // 6. Establecer Sinapsis
    for (const item of resolvedTargets) {
      try {
        await SynapseRepository.createSynapse(context, {
          sourceAtomId: coreAtom.id,
          targetAtomId: item.targetAtomId,
          relationType: item.relationType,
          metadata: item.metadata,
        });
      } catch {
        // Ignorar colisiones de índice único
      }
    }

    // 7. Auto-vinculación Bidireccional si se identificó un cliente existente para esta tarea/nota
    if (
      identityResolution.clientAtom
      && identityResolution.clientAtom.id !== coreAtom.id
    ) {
      const clientId = identityResolution.clientAtom.id;

      // Enlace Saliente: Tarea/Nota -> Cliente
      try {
        await SynapseRepository.createSynapse(context, {
          sourceAtomId: coreAtom.id,
          targetAtomId: clientId,
          relationType: 'ASSIGNED_TO',
          metadata: {
            auto_resolved: true,
            matchType: identityResolution.matchType,
            matchedValue: identityResolution.matchedValue,
          },
        });
      } catch {
        // Enlace ya existe
      }

      // Enlace Entrante Bidireccional: Cliente -> Tarea/Nota (RELATED_TO)
      try {
        await SynapseRepository.createSynapse(context, {
          sourceAtomId: clientId,
          targetAtomId: coreAtom.id,
          relationType: 'RELATED_TO',
          metadata: {
            auto_resolved: true,
            reverse_of: 'ASSIGNED_TO',
          },
        });
      } catch {
        // Enlace ya existe
      }
    }

    // 8. Proyectar y retornar la molécula completa
    const molecule = await SynapseRepository.getMolecule(context, coreAtom.id);
    if (!molecule) {
      throw new Error('Error al proyectar la molécula resultante');
    }

    return molecule;
  }
}
