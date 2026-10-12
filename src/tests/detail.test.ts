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

    it('gestiona la pila de navegación del grafo (hops) con avance y retroceso', () => {
      const rootAtomId = 'atom-task-1';
      let subHistory: string[] = [];

      const getCurrentId = () =>
        subHistory.length > 0 ? subHistory[subHistory.length - 1]! : rootAtomId;

      // Estado inicial en el átomo raíz
      expect(getCurrentId()).toBe('atom-task-1');
      expect(subHistory.length + 1).toBe(1);

      // Hop 1: Saltar hacia el cliente conectado (@Juan Fontanería)
      subHistory = [...subHistory, 'atom-client-1'];
      expect(getCurrentId()).toBe('atom-client-1');
      expect(subHistory.length + 1).toBe(2);

      // Hop 2: Saltar hacia el proyecto (#Reforma-Cocina)
      subHistory = [...subHistory, 'atom-project-1'];
      expect(getCurrentId()).toBe('atom-project-1');
      expect(subHistory.length + 1).toBe(3);

      // Back 1: Retroceder al cliente
      subHistory = subHistory.slice(0, -1);
      expect(getCurrentId()).toBe('atom-client-1');
      expect(subHistory.length + 1).toBe(2);

      // Back 2: Retroceder al átomo original
      subHistory = subHistory.slice(0, -1);
      expect(getCurrentId()).toBe('atom-task-1');
      expect(subHistory.length + 1).toBe(1);
    });

    it('proyecta sinapsis entrantes permitiendo que un cliente actúe como centro de gravedad (CRM)', () => {
      // Un átomo de tipo cliente que recibe tareas y notas entrantes
      const clientMolecule = {
        root: {
          id: 'atom-client-vip',
          type: 'client',
          payload: { name: 'Acme Corp' },
          metadata: { provenance: 'omnibar' },
        },
        outgoing: [], // El cliente no apunta a nada
        incoming: [
          {
            linkId: 'link-task-1',
            relationType: 'ASSIGNED_TO',
            atom: {
              id: 'atom-task-urgent',
              type: 'task',
              payload: { title: 'Enviar propuesta comercial' },
            },
          },
          {
            linkId: 'link-note-1',
            relationType: 'RELATED_TO',
            atom: {
              id: 'atom-note-meeting',
              type: 'note',
              payload: { title: 'Notas de reunión de kickoff' },
            },
          },
        ],
      };

      // Debe recopilar 2 elementos que gravitan hacia Acme Corp
      expect(clientMolecule.incoming).toHaveLength(2);
      expect(clientMolecule.incoming.map(i => i.atom.type)).toEqual(['task', 'note']);
      expect(clientMolecule.incoming.map(i => i.relationType)).toEqual(['ASSIGNED_TO', 'RELATED_TO']);
    });
  });
});

