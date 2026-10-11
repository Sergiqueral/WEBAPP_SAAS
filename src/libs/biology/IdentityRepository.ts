import type {
  Atom,
  AtomExternalIdentity,
  ExternalIdentityInput,
  TenantContext,
} from '@/types/biology';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { atomExternalIdentitiesSchema } from '@/models/Schema';
import {
  AtomExternalIdentitySchema,
  ExternalIdentityInputSchema,
} from '@/types/biology';
import { AccessGuard } from './AccessGuard';
import { AtomRepository } from './AtomRepository';

export class IdentityRepository {
  /**
   * Vincula un átomo existente con una entidad externa (ej. Google Contacts, STEL Order).
   */
  static async linkExternalIdentity(
    context: TenantContext,
    input: ExternalIdentityInput,
  ): Promise<AtomExternalIdentity> {
    AccessGuard.assertCanWrite(context);

    const validated = ExternalIdentityInputSchema.parse(input);

    // Asegurar que el átomo pertenece a la organización
    const atom = await AtomRepository.getAtomById(context, validated.atomId);
    if (!atom) {
      throw new Error('No se puede enlazar: el átomo no existe en esta organización.');
    }

    const [inserted] = await db
      .insert(atomExternalIdentitiesSchema)
      .values({
        organizationId: context.organizationId,
        atomId: validated.atomId,
        provider: validated.provider,
        externalId: validated.externalId,
        syncHash: validated.syncHash,
      })
      .onConflictDoUpdate({
        target: [
          atomExternalIdentitiesSchema.organizationId,
          atomExternalIdentitiesSchema.provider,
          atomExternalIdentitiesSchema.externalId,
        ],
        set: {
          atomId: validated.atomId,
          syncHash: validated.syncHash,
          lastSyncedAt: new Date(),
        },
      })
      .returning();

    return AtomExternalIdentitySchema.parse(inserted);
  }

  /**
   * Resolución Just-in-Time O(1):
   * Encuentra el átomo de Gorila asociado a un ID externo (ej. Google Contact ID, email o ID de ERP).
   */
  static async getAtomByExternalId(
    context: TenantContext,
    provider: string,
    externalId: string,
  ): Promise<Atom | null> {
    const normalizedProvider = provider.trim().toLowerCase();

    const [record] = await db
      .select()
      .from(atomExternalIdentitiesSchema)
      .where(
        and(
          eq(atomExternalIdentitiesSchema.organizationId, context.organizationId),
          eq(atomExternalIdentitiesSchema.provider, normalizedProvider),
          eq(atomExternalIdentitiesSchema.externalId, externalId),
        ),
      );

    if (!record) {
      return null;
    }

    return AtomRepository.getAtomById(context, record.atomId);
  }

  /**
   * Desvincula una identidad externa.
   */
  static async unlinkExternalIdentity(
    context: TenantContext,
    id: string,
  ): Promise<boolean> {
    AccessGuard.assertCanWrite(context);

    const result = await db
      .delete(atomExternalIdentitiesSchema)
      .where(
        and(
          eq(atomExternalIdentitiesSchema.id, id),
          eq(atomExternalIdentitiesSchema.organizationId, context.organizationId),
        ),
      )
      .returning({ id: atomExternalIdentitiesSchema.id });

    return result.length > 0;
  }
}
