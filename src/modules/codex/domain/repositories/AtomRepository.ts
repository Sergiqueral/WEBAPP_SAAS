import type { Atom, AtomInput, TenantContext } from '@/modules/codex/domain/types';
import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { atomsSchema } from '@/modules/codex/db/schema';
import { AccessDeniedError, AccessGuard } from '@/modules/codex/domain/security/AccessGuard';
import { AtomInputSchema, AtomSchema } from '@/modules/codex/domain/types';

export class AtomRepository {
  /**
   * Crea un nuevo átomo en la base de datos dentro del contexto de la organización.
   * Valida permisos y estructura Zod.
   */
  static async createAtom(
    context: TenantContext,
    input: AtomInput,
  ): Promise<Atom> {
    AccessGuard.assertCanWrite(context);

    const validated = AtomInputSchema.parse(input);

    const metadata = {
      ...validated.metadata,
      created_by_user_id: context.userId,
      provenance: validated.metadata?.provenance ?? 'manual',
    };

    const [inserted] = await db
      .insert(atomsSchema)
      .values({
        organizationId: context.organizationId,
        type: validated.type,
        payload: validated.payload,
        metadata,
      })
      .returning();

    if (!inserted) {
      throw new Error('Error al sintetizar el átomo');
    }

    return AtomSchema.parse(inserted);
  }

  /**
   * Obtiene un átomo por su ID asegurando el aislamiento por organización
   * y evaluando permisos del usuario (incluso invitados).
   */
  static async getAtomById(
    context: TenantContext,
    atomId: string,
  ): Promise<Atom | null> {
    const [atomRecord] = await db
      .select()
      .from(atomsSchema)
      .where(
        and(
          eq(atomsSchema.id, atomId),
          eq(atomsSchema.organizationId, context.organizationId),
        ),
      );

    if (!atomRecord) {
      return null;
    }

    const atom = AtomSchema.parse(atomRecord);

    if (!AccessGuard.canReadAtom(context, atom)) {
      throw new AccessDeniedError('Acceso denegado a este átomo');
    }

    return atom;
  }

  /**
   * Lista todos los átomos de un tipo específico para la organización.
   */
  static async getAtomsByType(
    context: TenantContext,
    type: string,
  ): Promise<Atom[]> {
    const normalizedType = type.trim().toLowerCase();

    const records = await db
      .select()
      .from(atomsSchema)
      .where(
        and(
          eq(atomsSchema.organizationId, context.organizationId),
          eq(atomsSchema.type, normalizedType),
        ),
      );

    return records
      .map(r => AtomSchema.parse(r))
      .filter(atom => AccessGuard.canReadAtom(context, atom));
  }

  /**
   * Actualiza el payload o metadata de un átomo existente.
   */
  static async updateAtom(
    context: TenantContext,
    atomId: string,
    patch: {
      payload?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Atom> {
    AccessGuard.assertCanWrite(context);

    const existing = await this.getAtomById(context, atomId);
    if (!existing) {
      throw new Error('Átomo no encontrado');
    }

    const updatedPayload = patch.payload
      ? { ...existing.payload, ...patch.payload }
      : existing.payload;

    const updatedMetadata = patch.metadata
      ? { ...existing.metadata, ...patch.metadata }
      : existing.metadata;

    const [updatedRecord] = await db
      .update(atomsSchema)
      .set({
        payload: updatedPayload,
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(atomsSchema.id, atomId),
          eq(atomsSchema.organizationId, context.organizationId),
        ),
      )
      .returning();

    return AtomSchema.parse(updatedRecord);
  }

  /**
   * Elimina un átomo y desencadena la eliminación en cascada de sus sinapsis.
   */
  static async deleteAtom(
    context: TenantContext,
    atomId: string,
  ): Promise<boolean> {
    AccessGuard.assertCanWrite(context);

    const result = await db
      .delete(atomsSchema)
      .where(
        and(
          eq(atomsSchema.id, atomId),
          eq(atomsSchema.organizationId, context.organizationId),
        ),
      )
      .returning({ id: atomsSchema.id });

    return result.length > 0;
  }
}
