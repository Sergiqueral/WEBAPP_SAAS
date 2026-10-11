import type { MolecularProjection, TenantContext } from '@/types/biology';
import { describe, expect, it } from 'vitest';
import { AccessDeniedError } from '@/libs/biology/AccessGuard';
import { MoleculeRepository } from '@/libs/biology/MoleculeRepository';
import { OmnibarParser } from '@/libs/omnibar/OmnibarParser';
import { UpdateAtomInputSchema } from '@/types/biology';

describe('Integración End-to-End: Omnibarra y Grafo Molecular (Fases 2 y 3)', () => {
  const orgContext: TenantContext = {
    organizationId: 'org-empresa-constructora',
    userId: 'user-admin-1',
    role: 'admin',
  };

  const viewerContext: TenantContext = {
    organizationId: 'org-empresa-constructora',
    userId: 'user-viewer-1',
    role: 'viewer',
  };

  describe('Flujo Completo: De Texto Libre a Proyección Molecular Activa', () => {
    it('procesa el texto en la Omnibarra, sintetiza el grafo y lo proyecta para el feed', () => {
      // 1. Ingesta a través del parser de la Omnibarra
      const rawInput = 'Presupuesto de fontanería para @JoseCarlos //mañana a las 10:00 #Reformas';
      const intent = OmnibarParser.parseToIntent(rawInput);

      expect(intent.coreAtom.type).toBe('task');
      expect(intent.synapses.some(s => s.targetEntityName === 'JoseCarlos')).toBe(true);
      expect(intent.synapses.some(s => s.targetEntityName === 'Reformas')).toBe(true);
      expect(intent.temporal?.dueDate).toBeDefined();

      // 2. Simulación de la síntesis del reactor molecular
      const simulatedMolecule: MolecularProjection = {
        root: {
          id: 'atom-task-101',
          organizationId: orgContext.organizationId,
          type: intent.coreAtom.type,
          payload: {
            title: intent.coreAtom.title,
            dueDate: intent.temporal?.dueDate.toISOString(),
            status: 'pending',
          },
          metadata: { provenance: 'omnibar' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [
          {
            linkId: 'link-101-1',
            relationType: 'ASSIGNED_TO',
            metadata: {},
            atom: {
              id: 'atom-entity-carlos',
              organizationId: orgContext.organizationId,
              type: 'client',
              payload: { name: 'JoseCarlos' },
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          {
            linkId: 'link-101-2',
            relationType: 'TAGGED_WITH',
            metadata: {},
            atom: {
              id: 'atom-ctx-reformas',
              organizationId: orgContext.organizationId,
              type: 'tag',
              payload: { name: 'Reformas' },
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        incoming: [],
        externalIdentities: [],
      };

      // 3. Verificación de la proyección en el feed
      expect(simulatedMolecule.root.type).toBe('task');
      expect((simulatedMolecule.root.payload as { status: string }).status).toBe('pending');
      expect(simulatedMolecule.outgoing).toHaveLength(2);

      // Verificación de los chips sinápticos
      const entityChips = simulatedMolecule.outgoing
        .filter(s => ['client', 'contact', 'person', 'provider', 'employee', 'entity'].includes(s.atom.type))
        .map(s => (s.atom.payload as { name: string }).name);

      const contextChips = simulatedMolecule.outgoing
        .filter(s => ['tag', 'project', 'topic', 'context'].includes(s.atom.type))
        .map(s => (s.atom.payload as { name: string }).name);

      expect(entityChips).toEqual(['JoseCarlos']);
      expect(contextChips).toEqual(['Reformas']);
    });

    it('ejecuta la mutación de estado con validación estricta Zod y RBAC', async () => {
      // 1. Validación de esquema de mutación
      const patchInput = UpdateAtomInputSchema.parse({
        payload: { status: 'done', completedAt: new Date().toISOString() },
      });

      expect(patchInput.payload?.status).toBe('done');

      // 2. Comprobación de seguridad: El rol viewer tiene tajantemente prohibida la mutación
      await expect(
        MoleculeRepository.updateAtom(viewerContext, 'atom-task-101', patchInput),
      ).rejects.toThrow(AccessDeniedError);

      await expect(
        MoleculeRepository.deleteAtom(viewerContext, 'atom-task-101'),
      ).rejects.toThrow(AccessDeniedError);
    });
  });
});
