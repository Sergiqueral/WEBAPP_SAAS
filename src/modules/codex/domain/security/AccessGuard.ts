import type { Atom, Link, Role, TenantContext } from '@/modules/codex/domain/types';

export class AccessDeniedError extends Error {
  constructor(message = 'Acceso denegado: permisos insuficientes en la organización') {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

export class AccessGuard {
  /**
   * Determina si un rol tiene permisos de escritura generales.
   * El rol 'viewer' (solo lectura) NUNCA puede escribir.
   */
  static canWrite(role: Role): boolean {
    return role === 'owner' || role === 'admin' || role === 'member';
  }

  /**
   * Lanza una excepción si el contexto no tiene permisos de mutación.
   * Protege mutaciones originadas desde la Web, Extensiones de Chrome o Add-ons.
   */
  static assertCanWrite(context: TenantContext): void {
    if (!this.canWrite(context.role)) {
      throw new AccessDeniedError(
        `Acceso denegado: el rol '${context.role}' no tiene permisos de modificación en esta organización.`,
      );
    }
  }

  /**
   * Determina si un usuario puede leer un átomo específico.
   * Reglas moleculares:
   * 1. Aislamiento estricto de organización.
   * 2. 'owner', 'admin', 'member' y 'viewer' tienen lectura libre en su organización.
   * 3. 'guest' (invitado) SOLO puede leer si:
   *    - Es el autor original del átomo, O
   *    - Existe una sinapsis explícita (SHARED_WITH o ASSIGNED_TO) hacia su ID de usuario o átomo.
   */
  static canReadAtom(
    context: TenantContext,
    atom: Atom,
    directSynapses: Link[] = [],
  ): boolean {
    // Regla 1: Aislamiento absoluto por organización
    if (atom.organizationId !== context.organizationId) {
      return false;
    }

    // Regla 2: Miembros estándar, administradores y observadores leen todo en su org
    if (context.role !== 'guest') {
      return true;
    }

    // Regla 3: Invitado molecular (guest)
    const authorId = atom.metadata?.created_by_user_id;
    if (authorId && authorId === context.userId) {
      return true;
    }

    // Comprobar si hay una sinapsis directa dirigida al usuario invitado
    const hasExplicitShare = directSynapses.some((link) => {
      const isSharedOrAssigned = link.relationType === 'SHARED_WITH' || link.relationType === 'ASSIGNED_TO';
      const targetsGuest = link.metadata?.target_user_id === context.userId;
      return isSharedOrAssigned && targetsGuest;
    });

    return hasExplicitShare;
  }
}
