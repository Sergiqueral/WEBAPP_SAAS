import type { Atom, Link, TenantContext } from '@/types/biology';
import { describe, expect, it } from 'vitest';
import { AccessDeniedError, AccessGuard } from '@/libs/biology/AccessGuard';
import {
  AtomInputSchema,
  ExternalIdentityInputSchema,
  SynapseInputSchema,
  TenantContextSchema,
} from '@/types/biology';

describe('Biología del Dato: Núcleo de Almacenamiento (Fase 1)', () => {
  describe('Contratos de Dominio y Normalización (Zod)', () => {
    it('normaliza el tipo de átomo a minúsculas sin espacios', () => {
      const input = {
        type: '  CLIENTE_VIP  ',
        payload: { nombre: 'Empresa Constructora SL' },
      };
      const parsed = AtomInputSchema.parse(input);

      expect(parsed.type).toBe('cliente_vip');
      expect(parsed.payload).toEqual({ nombre: 'Empresa Constructora SL' });
    });

    it('normaliza el relationType de la sinapsis a mayúsculas', () => {
      const input = {
        sourceAtomId: 'atom-1',
        targetAtomId: 'atom-2',
        relationType: '  assigned_to  ',
      };
      const parsed = SynapseInputSchema.parse(input);

      expect(parsed.relationType).toBe('ASSIGNED_TO');
    });

    it('normaliza el proveedor de identidad externa a minúsculas', () => {
      const input = {
        atomId: 'atom-1',
        provider: '  Google_Contacts  ',
        externalId: 'people/c12345',
      };
      const parsed = ExternalIdentityInputSchema.parse(input);

      expect(parsed.provider).toBe('google_contacts');
    });

    it('establece el rol por defecto en el TenantContext como "member"', () => {
      const context = TenantContextSchema.parse({
        organizationId: 'org-1',
        userId: 'user-1',
      });

      expect(context.role).toBe('member');
    });
  });

  describe('Control de Acceso y Políticas de Seguridad (AccessGuard)', () => {
    const orgId = 'org-constructora';

    it('permite escritura a roles owner, admin y member', () => {
      expect(AccessGuard.canWrite('owner')).toBe(true);
      expect(AccessGuard.canWrite('admin')).toBe(true);
      expect(AccessGuard.canWrite('member')).toBe(true);
    });

    it('deniega escritura tajantemente a usuarios viewer (solo lectura) y guest', () => {
      expect(AccessGuard.canWrite('viewer')).toBe(false);
      expect(AccessGuard.canWrite('guest')).toBe(false);
    });

    it('lanza AccessDeniedError si un viewer intenta mutar datos desde cualquier cliente', () => {
      const viewerContext: TenantContext = {
        organizationId: orgId,
        userId: 'user-viewer',
        role: 'viewer',
      };

      expect(() => AccessGuard.assertCanWrite(viewerContext)).toThrow(AccessDeniedError);
      expect(() => AccessGuard.assertCanWrite(viewerContext)).toThrow(
        /no tiene permisos de modificación/i,
      );
    });

    it('bloquea la lectura si el átomo pertenece a otra organización (Cross-Tenant Leak)', () => {
      const context: TenantContext = {
        organizationId: 'org-A',
        userId: 'user-1',
        role: 'admin',
      };

      const foreignAtom: Atom = {
        id: 'atom-foreign',
        organizationId: 'org-B',
        type: 'client',
        payload: { secret: 'información confidencial' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(AccessGuard.canReadAtom(context, foreignAtom)).toBe(false);
    });

    it('permite lectura libre a miembros y observadores dentro de su misma organización', () => {
      const contextViewer: TenantContext = {
        organizationId: orgId,
        userId: 'user-viewer',
        role: 'viewer',
      };

      const atom: Atom = {
        id: 'atom-1',
        organizationId: orgId,
        type: 'task',
        payload: { title: 'Revisar planos' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(AccessGuard.canReadAtom(contextViewer, atom)).toBe(true);
    });

    it('permite lectura a un invitado (guest) si es el autor original del átomo', () => {
      const guestContext: TenantContext = {
        organizationId: orgId,
        userId: 'guest-user-42',
        role: 'guest',
      };

      const ownAtom: Atom = {
        id: 'atom-own',
        organizationId: orgId,
        type: 'note',
        payload: { text: 'Mi nota de visita' },
        metadata: { created_by_user_id: 'guest-user-42' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(AccessGuard.canReadAtom(guestContext, ownAtom)).toBe(true);
    });

    it('deniega lectura a un invitado si no es el autor y no tiene sinapsis directa', () => {
      const guestContext: TenantContext = {
        organizationId: orgId,
        userId: 'guest-user-42',
        role: 'guest',
      };

      const otherAtom: Atom = {
        id: 'atom-other',
        organizationId: orgId,
        type: 'invoice',
        payload: { amount: 5000 },
        metadata: { created_by_user_id: 'admin-boss' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(AccessGuard.canReadAtom(guestContext, otherAtom)).toBe(false);
    });

    it('permite lectura a un invitado si existe una sinapsis SHARED_WITH hacia él', () => {
      const guestContext: TenantContext = {
        organizationId: orgId,
        userId: 'guest-user-42',
        role: 'guest',
      };

      const sharedAtom: Atom = {
        id: 'atom-shared',
        organizationId: orgId,
        type: 'task',
        payload: { title: 'Subir documentación de seguridad' },
        metadata: { created_by_user_id: 'admin-boss' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sharingSynapse: Link = {
        id: 'link-1',
        organizationId: orgId,
        sourceAtomId: 'atom-shared',
        targetAtomId: 'atom-guest-profile',
        relationType: 'SHARED_WITH',
        metadata: { target_user_id: 'guest-user-42' },
        createdAt: new Date(),
      };

      expect(AccessGuard.canReadAtom(guestContext, sharedAtom, [sharingSynapse])).toBe(true);
    });
  });
});
