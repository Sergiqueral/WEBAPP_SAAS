import type { MolecularProjection } from '@/types/biology';
import { describe, expect, it } from 'vitest';

describe('Visualización Molecular & Microinteracciones (Hito 3.2)', () => {
  const baseAtom = {
    id: 'atom-test-1',
    organizationId: 'org-test',
    type: 'task',
    payload: {
      title: 'Llamar a fontanero',
      status: 'pending',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    },
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleMolecule: MolecularProjection = {
    root: baseAtom,
    outgoing: [
      {
        linkId: 'link-1',
        relationType: 'ASSIGNED_TO',
        metadata: {},
        atom: {
          id: 'atom-client-1',
          organizationId: 'org-test',
          type: 'client',
          payload: { name: 'Juan Fontanería' },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        linkId: 'link-2',
        relationType: 'TAGGED_WITH',
        metadata: {},
        atom: {
          id: 'atom-ctx-1',
          organizationId: 'org-test',
          type: 'project',
          payload: { name: 'Reforma Cocina' },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
    incoming: [],
    externalIdentities: [],
  };

  describe('Ensamblado y Clasificación de Sinapsis Vecinas', () => {
    it('clasifica correctamente vecinos de entidad (@) y contexto (#)', () => {
      const neighbors = [...sampleMolecule.outgoing, ...sampleMolecule.incoming].map(s => s.atom);

      const entities = neighbors.filter(a =>
        ['client', 'contact', 'person', 'provider', 'employee', 'entity'].includes(a.type),
      );

      const contexts = neighbors.filter(a =>
        ['tag', 'project', 'topic', 'context'].includes(a.type),
      );

      expect(entities).toHaveLength(1);
      expect(entities[0]?.payload.name).toBe('Juan Fontanería');

      expect(contexts).toHaveLength(1);
      expect(contexts[0]?.payload.name).toBe('Reforma Cocina');
    });

    it('identifica el estado y título de la tarea raíz', () => {
      expect(sampleMolecule.root.type).toBe('task');
      expect((sampleMolecule.root.payload as { status: string }).status).toBe('pending');
      expect((sampleMolecule.root.payload as { title: string }).title).toBe('Llamar a fontanero');
    });
  });

  describe('Cálculo Relativo de Fechas de Vencimiento', () => {
    it('reconoce fechas futuras (mañana)', () => {
      const dueDate = new Date(Date.now() + 86400000);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBe(1);
    });

    it('identifica fechas vencidas en el pasado', () => {
      const pastDate = new Date(Date.now() - 86400000 * 2);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dueDay = new Date(pastDate.getFullYear(), pastDate.getMonth(), pastDate.getDate());
      const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeLessThan(0);
    });
  });

  describe('Optimismo y Transiciones de Estado Atómico', () => {
    it('conmuta el estado de pending a done de forma predecible', () => {
      const toggleStatus = (status: string) => (status === 'done' ? 'pending' : 'done');
      const nextStatus = toggleStatus('pending');

      expect(nextStatus).toBe('done');

      const toggledAgain = toggleStatus(nextStatus);

      expect(toggledAgain).toBe('pending');
    });
  });
});
