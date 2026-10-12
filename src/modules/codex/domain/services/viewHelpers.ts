import type { Atom, MolecularProjection } from '@/modules/codex/domain/types';

export type KanbanColumnId = 'pending' | 'in_progress' | 'done';

export type KanbanColumnDefinition = {
  id: KanbanColumnId;
  title: string;
  badgeColor: string;
  borderColor: string;
  emptyText: string;
};

export const KANBAN_COLUMNS: KanbanColumnDefinition[] = [
  {
    id: 'pending',
    title: 'Pendiente',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    borderColor: 'border-amber-500/30',
    emptyText: 'No hay elementos pendientes',
  },
  {
    id: 'in_progress',
    title: 'En Progreso',
    badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    borderColor: 'border-sky-500/30',
    emptyText: 'No hay elementos en curso',
  },
  {
    id: 'done',
    title: 'Completada',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    emptyText: 'No hay elementos completados',
  },
];

export function getAtomStatus(atom: Atom): KanbanColumnId {
  const payload = (atom.payload ?? {}) as Record<string, unknown>;
  const rawStatus = typeof payload.status === 'string' ? payload.status : 'pending';
  if (rawStatus === 'done') {
    return 'done';
  }
  if (rawStatus === 'in_progress') {
    return 'in_progress';
  }
  return 'pending';
}

export function groupMoleculesByKanbanStatus(
  molecules: MolecularProjection[],
): Record<KanbanColumnId, MolecularProjection[]> {
  const groups: Record<KanbanColumnId, MolecularProjection[]> = {
    pending: [],
    in_progress: [],
    done: [],
  };

  for (const molecule of molecules) {
    const status = getAtomStatus(molecule.root);
    groups[status].push(molecule);
  }

  return groups;
}

export type CalendarDay = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  molecules: MolecularProjection[];
};

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function groupMoleculesByDate(
  molecules: MolecularProjection[],
  year: number,
  month: number, // 0-indexed (0 = Enero, 11 = Diciembre)
): {
  days: CalendarDay[];
  unscheduled: MolecularProjection[];
} {
  const todayKey = formatDateKey(new Date());

  // Mapear moléculas con dueDate válido a su fecha clave
  const dateMap = new Map<string, MolecularProjection[]>();
  const unscheduled: MolecularProjection[] = [];

  for (const molecule of molecules) {
    const payload = (molecule.root.payload ?? {}) as Record<string, unknown>;
    const metadata = (molecule.root.metadata ?? {}) as Record<string, unknown>;
    const dueDateStr = typeof payload.dueDate === 'string'
      ? payload.dueDate
      : typeof metadata.due_date === 'string'
        ? metadata.due_date
        : null;

    if (!dueDateStr) {
      unscheduled.push(molecule);
      continue;
    }

    const due = new Date(dueDateStr);
    if (Number.isNaN(due.getTime())) {
      unscheduled.push(molecule);
      continue;
    }

    const key = formatDateKey(due);
    const existing = dateMap.get(key) ?? [];
    existing.push(molecule);
    dateMap.set(key, existing);
  }

  // Generar cuadrícula completa de 35 o 42 días (empezando en Lunes)
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // En JS: 0=Domingo, 1=Lunes, ..., 6=Sábado. Convertir a Lunes=0, ..., Domingo=6
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastDayOfMonth.getDate();

  const days: CalendarDay[] = [];

  // Días previos del mes anterior
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i);
    const key = formatDateKey(d);
    days.push({
      date: d,
      dateKey: key,
      isCurrentMonth: false,
      isToday: key === todayKey,
      molecules: dateMap.get(key) ?? [],
    });
  }

  // Días del mes en curso
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = formatDateKey(d);
    days.push({
      date: d,
      dateKey: key,
      isCurrentMonth: true,
      isToday: key === todayKey,
      molecules: dateMap.get(key) ?? [],
    });
  }

  // Días posteriores del mes siguiente para completar la cuadrícula (múltiplo de 7)
  const remainingCells = (7 - (days.length % 7)) % 7;
  // Asegurar al menos 5 filas (35 casillas)
  const totalTargetCells = days.length + remainingCells < 35 ? days.length + remainingCells + 7 : days.length + remainingCells;
  const nextMonthFill = totalTargetCells - days.length;

  for (let day = 1; day <= nextMonthFill; day++) {
    const d = new Date(year, month + 1, day);
    const key = formatDateKey(d);
    days.push({
      date: d,
      dateKey: key,
      isCurrentMonth: false,
      isToday: key === todayKey,
      molecules: dateMap.get(key) ?? [],
    });
  }

  return { days, unscheduled };
}

export function getMonthLabel(year: number, month: number, locale = 'es-ES'): string {
  const d = new Date(year, month, 1);
  const monthName = d.toLocaleDateString(locale, { month: 'long' });
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
}
