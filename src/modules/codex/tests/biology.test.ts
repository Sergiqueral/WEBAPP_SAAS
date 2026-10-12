import type { MolecularProjection } from '../domain/types';
import type { Atom, Link, TenantContext } from '@/modules/codex/domain/types';
import { describe, expect, it } from 'vitest';
import { AccessDeniedError, AccessGuard } from '@/modules/codex/domain/security/AccessGuard';
import {
  AtomInputSchema,
  ExternalIdentityInputSchema,
  SynapseInputSchema,
  TenantContextSchema,
} from '@/modules/codex/domain/types';
import { calculateCellMetrics } from '../domain/cell/cellMetrics';

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

  describe('Célula Biológica y Métricas Metabólicas (Paso 3)', () => {
    it('calcula métricas en cero si no hay moléculas', () => {
      const metrics = calculateCellMetrics([]);

      expect(metrics.total).toBe(0);
      expect(metrics.completed).toBe(0);
      expect(metrics.pending).toBe(0);
      expect(metrics.completionPercentage).toBe(0);
      expect(metrics.collaborators).toHaveLength(0);
    });

    it('calcula porcentaje y colaboradores a partir de sinapsis', () => {
      const entityCarlos: Atom = {
        id: 'entity-carlos',
        organizationId: 'org-1',
        type: 'entity',
        payload: { name: 'Carlos' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mol1: MolecularProjection = {
        root: {
          id: 'task-1',
          organizationId: 'org-1',
          type: 'task',
          payload: { title: 'Diseñar logo', status: 'done' },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [{
          linkId: 'l1',
          relationType: 'ASSIGNED_TO',
          metadata: {},
          atom: entityCarlos,
        }],
        incoming: [],
        externalIdentities: [],
      };

      const mol2: MolecularProjection = {
        root: {
          id: 'task-2',
          organizationId: 'org-1',
          type: 'task',
          payload: { title: 'Implementar UI', status: 'pending' },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [],
        incoming: [],
        externalIdentities: [],
      };

      const metrics = calculateCellMetrics([mol1, mol2], 'cell-marketing');

      expect(metrics.total).toBe(2);
      expect(metrics.completed).toBe(1);
      expect(metrics.pending).toBe(1);
      expect(metrics.completionPercentage).toBe(50);
      expect(metrics.collaborators).toHaveLength(1);
      expect(metrics.collaborators[0]?.id).toBe('entity-carlos');
    });
  });
});
