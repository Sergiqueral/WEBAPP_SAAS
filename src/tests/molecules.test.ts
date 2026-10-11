import type { MolecularProjection, TenantContext } from '@/types/biology';
import { describe, expect, it } from 'vitest';
import { AccessDeniedError } from '@/libs/biology/AccessGuard';
import { MoleculeRepository } from '@/libs/biology/MoleculeRepository';
import { UpdateAtomInputSchema } from '@/types/biology';

describe('MoleculeRepository & Gestión Molecular (Hito 3.1)', () => {
  describe('Contratos de Validación Zod para Mutaciones Atómicas', () => {
    it('valida el payload parcial para actualización de estado', () => {
      const validPatch = {
        payload: { status: 'done', completedAt: new Date().toISOString() },
      };

      const parsed = UpdateAtomInputSchema.parse(validPatch);

      expect(parsed.payload?.status).toBe('done');
    });

    it('permite actualizar metadata aisladamente', () => {
      const validMetaPatch = {
        metadata: { priority: 'high', flag: true },
      };

      const parsed = UpdateAtomInputSchema.parse(validMetaPatch);

      expect(parsed.metadata?.priority).toBe('high');
      expect(parsed.payload).toBeUndefined();
    });
  });

  describe('Control de Acceso RBAC en Mutaciones Atómicas', () => {
    const viewerContext: TenantContext = {
      organizationId: 'org-test-123',
      userId: 'user-viewer',
      role: 'viewer',
    };

    const guestContext: TenantContext = {
      organizationId: 'org-test-123',
      userId: 'user-guest',
      role: 'guest',
    };

    it('bloquea la actualización de átomo si el rol es viewer', async () => {
      await expect(
        MoleculeRepository.updateAtom(viewerContext, 'atom-1', { payload: { status: 'done' } }),
      ).rejects.toThrow(AccessDeniedError);
    });

    it('bloquea la eliminación de átomo si el rol es viewer', async () => {
      await expect(
        MoleculeRepository.deleteAtom(viewerContext, 'atom-1'),
      ).rejects.toThrow(AccessDeniedError);
    });

    it('bloquea la actualización de átomo si el rol es guest', async () => {
      await expect(
        MoleculeRepository.updateAtom(guestContext, 'atom-1', { payload: { status: 'done' } }),
      ).rejects.toThrow(AccessDeniedError);
    });

    it('bloquea la eliminación de átomo si el rol es guest', async () => {
      await expect(
        MoleculeRepository.deleteAtom(guestContext, 'atom-1'),
      ).rejects.toThrow(AccessDeniedError);
    });
  });

  describe('Estructura y Ensamblado de Proyecciones Moleculares', () => {
    it('representa una molécula con sus sinapsis salientes y entrantes', () => {
      const mockMolecule: MolecularProjection = {
        root: {
          id: 'atom-task-1',
          organizationId: 'org-test',
          type: 'task',
          payload: { title: 'Presupuesto reforma', status: 'pending' },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [
          {
            linkId: 'link-1',
            relationType: 'ASSIGNED_TO',
            metadata: {},
            atom: {
              id: 'atom-client-1',
              organizationId: 'org-test',
              type: 'client',
              payload: { name: 'Juan Perez' },
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        incoming: [],
        externalIdentities: [],
      };

      expect(mockMolecule.root.id).toBe('atom-task-1');
      expect(mockMolecule.outgoing).toHaveLength(1);
      expect(mockMolecule.outgoing[0]?.atom.payload.name).toBe('Juan Perez');
      expect(mockMolecule.incoming).toHaveLength(0);
    });
  });
});
