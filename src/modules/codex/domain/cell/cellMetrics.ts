import type { Atom, MolecularProjection } from '../types';

export type CellMetrics = {
  total: number;
  completed: number;
  pending: number;
  completionPercentage: number;
  byType: Record<string, number>;
  collaborators: Atom[];
};

/**
 * Calcula las métricas biológicas y de salud de una Célula (Contexto # o Entidad @)
 * a partir del conjunto de moléculas y sinapsis que operan dentro de su membrana.
 */
export function calculateCellMetrics(
  molecules: MolecularProjection[],
  cellAtomId?: string,
): CellMetrics {
  const total = molecules.length;
  let completed = 0;
  let pending = 0;
  const byType: Record<string, number> = {};
  const collaboratorMap = new Map<string, Atom>();

  for (const mol of molecules) {
    const root = mol.root;
    const type = root.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;

    const payload = (root.payload ?? {}) as Record<string, unknown>;
    const status = payload.status;
    if (status === 'done') {
      completed += 1;
    } else {
      pending += 1;
    }

    // Extraer colaboradores vinculados mediante sinapsis
    const allNeighbors = [...(mol.outgoing ?? []), ...(mol.incoming ?? [])];
    for (const neighbor of allNeighbors) {
      if (
        neighbor.atom
        && neighbor.atom.type === 'entity'
        && neighbor.atom.id !== cellAtomId
      ) {
        collaboratorMap.set(neighbor.atom.id, neighbor.atom);
      }
    }
  }

  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    pending,
    completionPercentage,
    byType,
    collaborators: Array.from(collaboratorMap.values()),
  };
}
