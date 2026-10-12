import type { MolecularProjection } from '@/types/biology';
import { describe, expect, it } from 'vitest';
import {
  formatDateKey,
  getAtomStatus,
  getMonthLabel,
  groupMoleculesByDate,
  groupMoleculesByKanbanStatus,
  KANBAN_COLUMNS,
} from '@/libs/biology/viewHelpers';

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
});
