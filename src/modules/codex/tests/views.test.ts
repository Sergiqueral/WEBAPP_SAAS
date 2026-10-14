import type { Atom, MolecularProjection } from '@/modules/codex/domain/types';
import { describe, expect, it } from 'vitest';
import {
  aggregateEntityIdentity,
  extractTemporalDimension,
  formatDateKey,
  getAtomStatus,
  getMonthLabel,
  groupMoleculesByDate,
  groupMoleculesByKanbanStatus,
  groupMoleculesForAgenda,
  KANBAN_COLUMNS,
} from '@/modules/codex/domain/services/viewHelpers';

describe('Vistas Multimodales - Helpers de Agrupación y Clasificación (Hito 5.1 & 5.3)', () => {
  const createMockMolecule = (id: string, status?: string, dueDate?: string): MolecularProjection => ({
    root: {
      id,
      organizationId: 'org-test',
      type: 'task',
      payload: {
        title: `Tarea ${id}`,
        ...(status ? { status } : {}),
        ...(dueDate ? { dueDate } : {}),
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    outgoing: [],
    incoming: [],
    externalIdentities: [],
  });

  describe('Clasificación por Estado Kanban', () => {
    it('extrae el estado del átomo por defecto como pending', () => {
      const mol = createMockMolecule('atom-1');

      expect(getAtomStatus(mol.root)).toBe('pending');
    });

    it('extrae in_progress y done correctamente', () => {
      const molProgress = createMockMolecule('atom-2', 'in_progress');
      const molDone = createMockMolecule('atom-3', 'done');

      expect(getAtomStatus(molProgress.root)).toBe('in_progress');
      expect(getAtomStatus(molDone.root)).toBe('done');
    });

    it('agrupa moléculas en las 3 columnas canónicas de Kanban', () => {
      const molecules = [
        createMockMolecule('1', 'pending'),
        createMockMolecule('2', 'in_progress'),
        createMockMolecule('3', 'done'),
        createMockMolecule('4'), // sin status explícito -> pending
        createMockMolecule('5', 'in_progress'),
      ];

      const groups = groupMoleculesByKanbanStatus(molecules);

      expect(groups.pending).toHaveLength(2);
      expect(groups.in_progress).toHaveLength(2);
      expect(groups.done).toHaveLength(1);
      expect(KANBAN_COLUMNS).toHaveLength(3);
    });

    it('gestiona correctamente transiciones dinámicas de estado simulando drag-and-drop', () => {
      let molecules = [
        createMockMolecule('atom-task-1', 'pending'),
      ];

      // Estado inicial en Pending
      let groups = groupMoleculesByKanbanStatus(molecules);

      expect(groups.pending).toHaveLength(1);
      expect(groups.in_progress).toHaveLength(0);
      expect(groups.done).toHaveLength(0);

      // Simular arrastre hacia 'in_progress'
      molecules = molecules.map(m => ({
        ...m,
        root: {
          ...m.root,
          payload: { ...((m.root.payload ?? {}) as Record<string, unknown>), status: 'in_progress' },
        },
      }));
      groups = groupMoleculesByKanbanStatus(molecules);

      expect(groups.pending).toHaveLength(0);
      expect(groups.in_progress).toHaveLength(1);
      expect(groups.done).toHaveLength(0);

      // Simular arrastre hacia 'done'
      molecules = molecules.map(m => ({
        ...m,
        root: {
          ...m.root,
          payload: { ...((m.root.payload ?? {}) as Record<string, unknown>), status: 'done' },
        },
      }));
      groups = groupMoleculesByKanbanStatus(molecules);

      expect(groups.pending).toHaveLength(0);
      expect(groups.in_progress).toHaveLength(0);
      expect(groups.done).toHaveLength(1);
    });
  });

  describe('Agrupación Temporal para Calendario', () => {
    it('formatea fechas clave en formato YYYY-MM-DD', () => {
      const d = new Date(2026, 9, 15); // Octubre 15, 2026

      expect(formatDateKey(d)).toBe('2026-10-15');
    });

    it('asigna moléculas con dueDate al día correspondiente y separa las no programadas', () => {
      const molecules = [
        createMockMolecule('1', 'pending', '2026-10-15T10:00:00.000Z'),
        createMockMolecule('2', 'done', '2026-10-15T18:00:00.000Z'),
        createMockMolecule('3', 'in_progress', '2026-10-20T09:00:00.000Z'),
        createMockMolecule('4', 'pending'), // sin fecha
        createMockMolecule('5', 'pending', 'fecha-invalida'),
      ];

      // Octubre 2026 (mes 9 en 0-indexed)
      const { days, unscheduled } = groupMoleculesByDate(molecules, 2026, 9);

      // Debe haber generado una cuadrícula completa de días (múltiplo de 7, al menos 35)
      expect(days.length).toBeGreaterThanOrEqual(35);
      expect(days.length % 7).toBe(0);

      // Verificar elementos no programados
      expect(unscheduled).toHaveLength(2);
      expect(unscheduled.map(m => m.root.id)).toEqual(['4', '5']);

      // Buscar el día 2026-10-15 en la cuadrícula
      const day15 = days.find(d => d.dateKey === '2026-10-15');

      expect(day15).toBeDefined();
      expect(day15?.molecules).toHaveLength(2);
      expect(day15?.isCurrentMonth).toBe(true);

      // Buscar el día 2026-10-20
      const day20 = days.find(d => d.dateKey === '2026-10-20');

      expect(day20).toBeDefined();
      expect(day20?.molecules).toHaveLength(1);
    });

    it('genera etiquetas legibles de mes y año', () => {
      const label = getMonthLabel(2026, 9, 'es-ES');

      expect(label.toLowerCase()).toContain('octubre');
      expect(label).toContain('2026');
    });

    it('asigna correctamente partículas en casillas del mes anterior visibles en la cuadrícula', () => {
      // Octubre 2026 empieza en Jueves (1 de Octubre de 2026).
      // Los días Lun 28, Mar 29, Mié 30 de Septiembre de 2026 aparecen en la primera fila.
      const molecules = [
        createMockMolecule('sep-day', 'pending', '2026-09-30T10:00:00.000Z'),
      ];

      const { days } = groupMoleculesByDate(molecules, 2026, 9);
      const sep30 = days.find(d => d.dateKey === '2026-09-30');

      expect(sep30).toBeDefined();
      expect(sep30?.isCurrentMonth).toBe(false);
      expect(sep30?.molecules).toHaveLength(1);
    });
  });

  describe('Navegación Fractal y Filtrado por Sinapsis (Hito 5.4)', () => {
    it('proyecta y filtra moléculas conectadas a un átomo objetivo de la sinapsis', () => {
      const entityAtom = {
        id: 'entity-alberto',
        organizationId: 'org-test',
        type: 'person',
        payload: { name: 'Alberto' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const task1: MolecularProjection = {
        root: {
          id: 'task-1',
          organizationId: 'org-test',
          type: 'task',
          payload: { title: 'Cita con Alberto' },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [{
          linkId: 'link-1',
          relationType: 'ASSIGNED_TO',
          atom: entityAtom,
          metadata: {},
        }],
        incoming: [],
        externalIdentities: [],
      };

      const task2: MolecularProjection = {
        root: {
          id: 'task-2',
          organizationId: 'org-test',
          type: 'task',
          payload: { title: 'Comprar materiales' },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [],
        incoming: [],
        externalIdentities: [],
      };

      const molecules = [task1, task2];

      const connected = molecules.filter(m =>
        m.outgoing.some(s => s.atom.id === 'entity-alberto')
        || m.incoming.some(s => s.atom.id === 'entity-alberto'),
      );

      expect(connected).toHaveLength(1);
      expect(connected[0]?.root.id).toBe('task-1');
    });
  });

  describe('Lente Molecular de Cliente - Agregación de Identidad y Átomos Dispersos (EntityLens)', () => {
    it('agrega anclajes duros, documentos fiscales y clasifica átomos en clusters moleculares', () => {
      const clientAtom: Atom = {
        id: 'client-1',
        organizationId: 'org-test',
        type: 'client',
        payload: {
          name: 'Jose Martines',
          phones: ['+34610932115'],
          documents: [{ documentNumber: '12345678Z', type: 'DNI', isValid: true }],
          locations: [{ normalized: 'c/ Pau Casals 12, Tortosa', type: 'address' }],
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const taskMol: MolecularProjection = {
        root: {
          id: 'task-10',
          organizationId: 'org-test',
          type: 'task',
          payload: {
            title: 'Llamar al 610932115 el miércoles para confirmar oferta',
            status: 'pending',
            dueDate: '2026-10-15T10:00:00Z',
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [],
        incoming: [],
        externalIdentities: [],
      };

      const docMol: MolecularProjection = {
        root: {
          id: 'doc-1',
          organizationId: 'org-test',
          type: 'note',
          payload: {
            title: 'Presupuesto instalación fotovoltaica',
            documents: [{ documentNumber: 'B12345674', type: 'CIF', isValid: true }],
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [],
        incoming: [],
        externalIdentities: [],
      };

      const noteMol: MolecularProjection = {
        root: {
          id: 'note-1',
          organizationId: 'org-test',
          type: 'note',
          payload: { content: 'Cliente prefiere contacto por la mañana' },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [],
        incoming: [],
        externalIdentities: [],
      };

      const rootMolecule: MolecularProjection = {
        root: clientAtom,
        outgoing: [{
          linkId: 'link-assigned',
          relationType: 'ASSIGNED_TO',
          atom: taskMol.root,
          metadata: {},
        }],
        incoming: [{
          linkId: 'link-related',
          relationType: 'RELATED_TO',
          atom: docMol.root,
          metadata: {},
        }],
        externalIdentities: [],
      };

      const aggregated = aggregateEntityIdentity(clientAtom, [taskMol, docMol, noteMol], rootMolecule);

      expect(aggregated.primaryName).toBe('Jose Martines');
      expect(aggregated.phones).toContain('+34610932115');
      expect(aggregated.documents).toHaveLength(2); // 12345678Z (DNI) + B12345674 (CIF)
      expect(aggregated.locations).toHaveLength(1);
      expect(aggregated.locations[0]?.normalized).toBe('c/ Pau Casals 12, Tortosa');

      // Verificación de Clusters Moleculares
      expect(aggregated.tasks).toHaveLength(1);
      expect(aggregated.tasks[0]?.root.id).toBe('task-10');
      expect(aggregated.documentsClusters).toHaveLength(1);
      expect(aggregated.documentsClusters[0]?.root.id).toBe('doc-1');
      expect(aggregated.notes).toHaveLength(1);
      expect(aggregated.notes[0]?.root.id).toBe('note-1');

      // Verificación de sinapsis
      expect(aggregated.synapses).toHaveLength(2);
      expect(aggregated.synapses.find(s => s.direction === 'outgoing')?.relationType).toBe('ASSIGNED_TO');
      expect(aggregated.synapses.find(s => s.direction === 'incoming')?.relationType).toBe('RELATED_TO');
    });

    it('genera nombre de respaldo automático si el átomo raíz carece de nombre explícito', () => {
      const anonAtom: Atom = {
        id: 'anon-1',
        organizationId: 'org-test',
        type: 'client',
        payload: {
          phones: ['+34610932115'],
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const aggregated = aggregateEntityIdentity(anonAtom, []);

      expect(aggregated.primaryName).toBe('Contacto +34610932115');
    });
  });

  describe('Dimensión Temporal de Átomos y Eventos (extractTemporalDimension)', () => {
    it('extrae fecha polimórfica desde dueDate, date, eventDate o due_date en metadata', () => {
      const targetDate = new Date(2026, 9, 22, 10, 30);
      const molDueDate = createMockMolecule('m-1', 'pending', targetDate.toISOString());
      const temp1 = extractTemporalDimension(molDueDate);

      expect(temp1.hasDate).toBe(true);
      expect(temp1.dateKey).toBe(formatDateKey(targetDate));
      expect(temp1.hasTime).toBe(true);
      expect(temp1.timeLabel).toBe('10:30');
      expect(temp1.isAllDay).toBe(false);

      const molDate: MolecularProjection = {
        root: {
          id: 'm-2',
          organizationId: 'org-test',
          type: 'event',
          payload: { title: 'Visita técnica', date: '2026-10-25' },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [],
        incoming: [],
        externalIdentities: [],
      };
      const temp2 = extractTemporalDimension(molDate);

      expect(temp2.hasDate).toBe(true);
      expect(temp2.dateKey).toBe('2026-10-25');
      expect(temp2.isAllDay).toBe(true);

      const molEventDate: MolecularProjection = {
        root: {
          id: 'm-3',
          organizationId: 'org-test',
          type: 'event',
          payload: { title: 'Revisión caldera', eventDate: '2026-11-05T16:00:00.000Z' },
          metadata: { has_time: true },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [],
        incoming: [],
        externalIdentities: [],
      };
      const temp3 = extractTemporalDimension(molEventDate);

      expect(temp3.hasDate).toBe(true);
      expect(temp3.dateKey).toBe('2026-11-05');
      expect(temp3.hasTime).toBe(true);

      const molMetaDate: MolecularProjection = {
        root: {
          id: 'm-4',
          organizationId: 'org-test',
          type: 'note',
          payload: { title: 'Nota con vencimiento' },
          metadata: { due_date: '2026-12-01T00:00:00.000Z' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [],
        incoming: [],
        externalIdentities: [],
      };
      const temp4 = extractTemporalDimension(molMetaDate);

      expect(temp4.hasDate).toBe(true);
      expect(temp4.dateKey).toBe('2026-12-01');
    });

    it('identifica eventos tentativos o condicionales', () => {
      const molTentative: MolecularProjection = {
        root: {
          id: 'm-tentative',
          organizationId: 'org-test',
          type: 'event',
          payload: {
            title: 'Posible reunión',
            dueDate: '2026-10-22T10:00:00.000Z',
            isTentative: true,
          },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        outgoing: [],
        incoming: [],
        externalIdentities: [],
      };
      const temp = extractTemporalDimension(molTentative);

      expect(temp.hasDate).toBe(true);
      expect(temp.isTentative).toBe(true);
    });

    it('gestiona átomos sin fecha con tolerancia sin errores', () => {
      const molNoDate = createMockMolecule('m-nodate');
      const temp = extractTemporalDimension(molNoDate);

      expect(temp.hasDate).toBe(false);
      expect(temp.date).toBeNull();
      expect(temp.dateKey).toBeNull();
    });
  });

  describe('Agrupación Cronológica para Agenda (groupMoleculesForAgenda)', () => {
    it('agrupa moléculas por día en orden cronológico y separa no programadas', () => {
      const molecules: MolecularProjection[] = [
        createMockMolecule('ev-1', 'pending', '2026-10-15T09:00:00.000Z'),
        createMockMolecule('ev-2', 'pending', '2026-10-15T15:30:00.000Z'),
        createMockMolecule('ev-3', 'pending', '2026-10-16T11:00:00.000Z'),
        createMockMolecule('no-date-1'),
      ];

      const { groups, unscheduled } = groupMoleculesForAgenda(molecules);

      expect(groups).toHaveLength(2);
      expect(groups[0]?.dateKey).toBe('2026-10-15');
      expect(groups[0]?.molecules).toHaveLength(2);
      expect(groups[1]?.dateKey).toBe('2026-10-16');
      expect(groups[1]?.molecules).toHaveLength(1);
      expect(unscheduled).toHaveLength(1);
      expect(unscheduled[0]?.root.id).toBe('no-date-1');
    });
  });
});
