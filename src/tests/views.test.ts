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

describe('Vistas Multimodales - Helpers de Agrupación y Clasificación (Hito 5.1)', () => {
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
  });
});
