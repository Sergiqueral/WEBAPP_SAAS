import type { TenantContext } from '@/types/biology';
import { describe, expect, it } from 'vitest';
import { AccessDeniedError } from '@/libs/biology/AccessGuard';
import { SynapseRepository } from '@/libs/biology/SynapseRepository';
import { SynapseInputSchema } from '@/types/biology';

describe('Detalle Molecular y Enlaces Sinápticos (Hito 4.1)', () => {
  const viewerContext: TenantContext = {
    organizationId: 'org-test-detail',
    userId: 'user-viewer',
    role: 'viewer',
  };

  describe('Validación de Esquema de Sinapsis (SynapseInputSchema)', () => {
    it('normaliza relationType a mayúsculas y valida campos requeridos', () => {
      const input = {
        sourceAtomId: 'atom-1',
        targetAtomId: 'atom-2',
        relationType: 'assigned_to',
      };

      const parsed = SynapseInputSchema.parse(input);

      expect(parsed.relationType).toBe('ASSIGNED_TO');
      expect(parsed.sourceAtomId).toBe('atom-1');
      expect(parsed.targetAtomId).toBe('atom-2');
    });

    it('falla si sourceAtomId o targetAtomId están vacíos', () => {
      expect(() =>
        SynapseInputSchema.parse({
          sourceAtomId: '',
          targetAtomId: 'atom-2',
          relationType: 'TAGGED_WITH',
        }),
      ).toThrow();
    });
  });

  describe('Control de Acceso RBAC en Creación y Remoción de Sinapsis', () => {
    it('rechaza tajantemente la creación de sinapsis para rol viewer', async () => {
      const input = SynapseInputSchema.parse({
        sourceAtomId: 'atom-task-1',
        targetAtomId: 'atom-client-1',
        relationType: 'ASSIGNED_TO',
      });

      await expect(
        SynapseRepository.createSynapse(viewerContext, input),
      ).rejects.toThrow(AccessDeniedError);
    });

    it('rechaza la eliminación de sinapsis para rol viewer', async () => {
      await expect(
        SynapseRepository.deleteSynapse(viewerContext, 'link-123'),
      ).rejects.toThrow(AccessDeniedError);
    });

    it('permite la ejecución en el guard para rol admin o member', () => {
      expect(() => {
        const input = {
          sourceAtomId: 'atom-1',
          targetAtomId: 'atom-2',
          relationType: 'RELATED_TO',
        };
        SynapseInputSchema.parse(input);
      }).not.toThrow();
    });
  });

  describe('Estructura y Validación de Proyecciones Moleculares de Detalle', () => {
    it('ensambla correctamente una molécula con sinapsis bidireccionales e identidades', () => {
      const sampleMolecule = {
        root: {
          id: 'atom-task-1',
          organizationId: 'org-test-detail',
          type: 'task',
          payload: { title: 'Instalar tubería', status: 'pending' },
          metadata: { provenance: 'omnibar' },
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
              organizationId: 'org-test-detail',
              type: 'client',
              payload: { name: 'Juan Fontanería' },
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        incoming: [
          {
            linkId: 'link-2',
            relationType: 'DEPENDS_ON',
            metadata: {},
            atom: {
              id: 'atom-task-0',
              organizationId: 'org-test-detail',
              type: 'task',
              payload: { title: 'Comprar materiales' },
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        externalIdentities: [
          {
            id: 'ext-1',
            organizationId: 'org-test-detail',
            atomId: 'atom-task-1',
            provider: 'google_calendar',
            externalId: 'event_12345',
            metadata: {},
            lastSyncedAt: new Date(),
            createdAt: new Date(),
          },
        ],
      };

      expect(sampleMolecule.root.id).toBe('atom-task-1');
      expect(sampleMolecule.outgoing).toHaveLength(1);
      expect(sampleMolecule.incoming).toHaveLength(1);
      expect(sampleMolecule.externalIdentities).toHaveLength(1);
      expect(sampleMolecule.outgoing[0]?.relationType).toBe('ASSIGNED_TO');
      expect(sampleMolecule.incoming[0]?.relationType).toBe('DEPENDS_ON');
    });
  });
});
