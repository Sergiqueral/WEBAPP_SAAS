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

export type TemporalDimension = {
  hasDate: boolean;
  date: Date | null;
  dateKey: string | null;
  hasTime: boolean;
  timeLabel: string | null;
  isTentative: boolean;
  isAllDay: boolean;
  rawExpression?: string | null;
};

/**
 * Extractor polimórfico de la dimensión temporal de cualquier átomo o molécula.
 * En Gorila (Biología del Dato), cualquier átomo que posea una fecha adquiere
 * estatus temporal y califica para su proyección en el calendario/agenda.
 */
export function extractTemporalDimension(molecule: MolecularProjection): TemporalDimension {
  const payload = (molecule.root.payload ?? {}) as Record<string, unknown>;
  const metadata = (molecule.root.metadata ?? {}) as Record<string, unknown>;

  // 1. Extraer fecha polimórfica (dueDate, date, eventDate, startDate, due_date)
  const candidateDateStr = typeof payload.dueDate === 'string' && payload.dueDate
    ? payload.dueDate
    : typeof payload.date === 'string' && payload.date
      ? payload.date
      : typeof payload.eventDate === 'string' && payload.eventDate
        ? payload.eventDate
        : typeof payload.startDate === 'string' && payload.startDate
          ? payload.startDate
          : typeof metadata.due_date === 'string' && metadata.due_date
            ? metadata.due_date
            : typeof metadata.date === 'string' && metadata.date
              ? metadata.date
              : null;

  if (!candidateDateStr) {
    return {
      hasDate: false,
      date: null,
      dateKey: null,
      hasTime: false,
      timeLabel: null,
      isTentative: false,
      isAllDay: true,
      rawExpression: null,
    };
  }

  const parsedDate = new Date(candidateDateStr);
  if (Number.isNaN(parsedDate.getTime())) {
    return {
      hasDate: false,
      date: null,
      dateKey: null,
      hasTime: false,
      timeLabel: null,
      isTentative: false,
      isAllDay: true,
      rawExpression: null,
    };
  }

  // 2. Determinar si tiene hora explícita
  let hasTime = Boolean(metadata.has_time) || Boolean(payload.hasTime);
  if (!hasTime && candidateDateStr.includes('T')) {
    const hours = parsedDate.getHours();
    const minutes = parsedDate.getMinutes();
    if (hours !== 0 || minutes !== 0) {
      hasTime = true;
    }
  }

  const timeLabel = hasTime
    ? `${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`
    : null;

  const isTentative = Boolean(payload.isTentative)
    || Boolean(metadata.is_tentative)
    || (Array.isArray(payload.conditions) && payload.conditions.length > 0);

  const rawExpression = typeof metadata.raw_expression === 'string'
    ? metadata.raw_expression
    : typeof payload.rawExpression === 'string'
      ? payload.rawExpression
      : null;

  return {
    hasDate: true,
    date: parsedDate,
    dateKey: formatDateKey(parsedDate),
    hasTime,
    timeLabel,
    isTentative,
    isAllDay: !hasTime,
    rawExpression,
  };
}

export type AgendaGroup = {
  date: Date;
  dateKey: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
  molecules: Array<{
    molecule: MolecularProjection;
    temporal: TemporalDimension;
  }>;
};

/**
 * Agrupa moléculas ordenadas cronológicamente para vistas tipo Agenda / Mobile Feed.
 */
export function groupMoleculesForAgenda(
  molecules: MolecularProjection[],
  options: { referenceDate?: Date } = {},
): {
  groups: AgendaGroup[];
  unscheduled: MolecularProjection[];
} {
  const refDate = options.referenceDate ?? new Date();
  const todayKey = formatDateKey(refDate);

  const groupsMap = new Map<string, Array<{ molecule: MolecularProjection; temporal: TemporalDimension }>>();
  const unscheduled: MolecularProjection[] = [];

  for (const molecule of molecules) {
    const temporal = extractTemporalDimension(molecule);
    if (!temporal.hasDate || !temporal.dateKey || !temporal.date) {
      unscheduled.push(molecule);
      continue;
    }

    const existing = groupsMap.get(temporal.dateKey) ?? [];
    existing.push({ molecule, temporal });
    groupsMap.set(temporal.dateKey, existing);
  }

  const sortedKeys = Array.from(groupsMap.keys()).sort();
  const groups: AgendaGroup[] = [];

  for (const dateKey of sortedKeys) {
    const items = groupsMap.get(dateKey)!;
    items.sort((a, b) => {
      if (a.temporal.isAllDay && !b.temporal.isAllDay) {
        return -1;
      }
      if (!a.temporal.isAllDay && b.temporal.isAllDay) {
        return 1;
      }
      return (a.temporal.date?.getTime() ?? 0) - (b.temporal.date?.getTime() ?? 0);
    });

    const [y, m, d] = dateKey.split('-').map(Number);
    const dateObj = new Date(y!, m! - 1, d!);
    const isToday = dateKey === todayKey;
    const isPast = dateKey < todayKey;

    let label = dateObj.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    label = label.charAt(0).toUpperCase() + label.slice(1);

    if (isToday) {
      label = `Hoy, ${label}`;
    }

    groups.push({
      date: dateObj,
      dateKey,
      label,
      isToday,
      isPast,
      molecules: items,
    });
  }

  return { groups, unscheduled };
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

  // Mapear moléculas con fecha válida polimórfica a su fecha clave
  const dateMap = new Map<string, MolecularProjection[]>();
  const unscheduled: MolecularProjection[] = [];

  for (const molecule of molecules) {
    const temporal = extractTemporalDimension(molecule);

    if (!temporal.hasDate || !temporal.dateKey) {
      unscheduled.push(molecule);
      continue;
    }

    const key = temporal.dateKey;
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

// ==========================================
// LENTE MOLECULAR DE ENTIDAD (EntityLens Helpers)
// ==========================================

export type AggregatedEntityIdentity = {
  primaryName: string;
  phones: string[];
  emails: string[];
  documents: Array<{ documentNumber: string; type: string; isValid: boolean }>;
  locations: Array<{ normalized: string; type: string; coordinates?: { lat: number; lng: number } }>;
  tasks: MolecularProjection[];
  notes: MolecularProjection[];
  documentsClusters: MolecularProjection[];
  events: MolecularProjection[];
  allConnected: MolecularProjection[];
  synapses: Array<{
    linkId: string;
    relationType: string;
    neighbor: Atom;
    direction: 'outgoing' | 'incoming';
  }>;
};

/**
 * Agrega y clasifica todos los átomos dispersos y anclajes moleculares
 * vinculados a un cliente o entidad en el grafo Codex.
 */
export function aggregateEntityIdentity(
  rootAtom: Atom | null,
  connectedMolecules: MolecularProjection[] = [],
  rootMolecule?: MolecularProjection | null,
): AggregatedEntityIdentity {
  const rootPayload = (rootAtom?.payload ?? {}) as Record<string, unknown>;

  // 1. Extraer nombre principal
  let primaryName = typeof rootPayload.name === 'string' && rootPayload.name.trim()
    ? rootPayload.name.trim()
    : typeof rootPayload.title === 'string' && rootPayload.title.trim()
      ? rootPayload.title.trim()
      : '';

  // 2. Extraer teléfonos (Hard Anchors)
  const phoneSet = new Set<string>();
  if (Array.isArray(rootPayload.phones)) {
    for (const p of rootPayload.phones) {
      if (typeof p === 'string' && p.trim()) {
        phoneSet.add(p.trim());
      }
    }
  }
  if (typeof rootPayload.phone === 'string' && rootPayload.phone.trim()) {
    phoneSet.add(rootPayload.phone.trim());
  }

  // 3. Extraer emails (Hard Anchors)
  const emailSet = new Set<string>();
  if (Array.isArray(rootPayload.emails)) {
    for (const e of rootPayload.emails) {
      if (typeof e === 'string' && e.trim()) {
        emailSet.add(e.trim().toLowerCase());
      }
    }
  }
  if (typeof rootPayload.email === 'string' && rootPayload.email.trim()) {
    emailSet.add(rootPayload.email.trim().toLowerCase());
  }

  // 4. Extraer documentos fiscales (DNI, NIE, CIF)
  const docMap = new Map<string, { documentNumber: string; type: string; isValid: boolean }>();
  if (Array.isArray(rootPayload.documents)) {
    for (const d of rootPayload.documents as Array<{ documentNumber?: string; type?: string; isValid?: boolean }>) {
      if (d && typeof d.documentNumber === 'string') {
        docMap.set(d.documentNumber, {
          documentNumber: d.documentNumber,
          type: d.type ?? 'DNI',
          isValid: Boolean(d.isValid),
        });
      }
    }
  }

  // 5. Extraer ubicaciones geográficas (GPS, Plus Codes, Direcciones)
  const locMap = new Map<string, { normalized: string; type: string; coordinates?: { lat: number; lng: number } }>();
  if (Array.isArray(rootPayload.locations)) {
    for (const loc of rootPayload.locations as Array<{ normalized?: string; type?: string; coordinates?: { lat: number; lng: number } }>) {
      if (loc && typeof loc.normalized === 'string') {
        locMap.set(loc.normalized, {
          normalized: loc.normalized,
          type: loc.type ?? 'address',
          coordinates: loc.coordinates,
        });
      }
    }
  }

  // 6. Recorrer moléculas conectadas para enriquecer anclajes y clasificar clusters
  const tasks: MolecularProjection[] = [];
  const notes: MolecularProjection[] = [];
  const documentsClusters: MolecularProjection[] = [];
  const events: MolecularProjection[] = [];

  for (const mol of connectedMolecules) {
    const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
    const text = String(payload.title ?? payload.content ?? payload.name ?? '');

    // Buscar si aporta teléfonos adicionales
    if (Array.isArray(payload.phones)) {
      for (const p of payload.phones) {
        if (typeof p === 'string') {
          phoneSet.add(p.trim());
        }
      }
    }

    // Buscar si aporta emails adicionales
    if (Array.isArray(payload.emails)) {
      for (const e of payload.emails) {
        if (typeof e === 'string') {
          emailSet.add(e.trim().toLowerCase());
        }
      }
    }

    // Buscar si aporta documentos
    if (Array.isArray(payload.documents)) {
      for (const d of payload.documents as Array<{ documentNumber?: string; type?: string; isValid?: boolean }>) {
        if (d && typeof d.documentNumber === 'string' && !docMap.has(d.documentNumber)) {
          docMap.set(d.documentNumber, {
            documentNumber: d.documentNumber,
            type: d.type ?? 'DNI',
            isValid: Boolean(d.isValid),
          });
        }
      }
    }

    // Clasificación por cluster
    const isTask = mol.root.type === 'task' || typeof payload.status === 'string';
    const isDoc = mol.root.type === 'document' || /\b(?:oferta|presupuesto|contrato|factura|albar[aá]n|recibo)\b/i.test(text);
    const isEvent = mol.root.type === 'event' || Boolean(payload.eventDate);
    const isNote = mol.root.type === 'note' || mol.root.type === 'inbox';

    if (isTask) {
      tasks.push(mol);
    } else if (isDoc) {
      documentsClusters.push(mol);
    } else if (isEvent) {
      events.push(mol);
    } else if (isNote) {
      notes.push(mol);
    } else {
      notes.push(mol);
    }
  }

  // Si no había nombre principal en la raíz, intentar deducirlo de los vecinos
  if (!primaryName) {
    primaryName = phoneSet.size > 0
      ? `Contacto ${Array.from(phoneSet)[0]}`
      : emailSet.size > 0
        ? `Contacto ${Array.from(emailSet)[0]}`
        : 'Entidad / Cliente';
  }

  // 7. Extraer sinapsis de primer nivel
  const synapses: AggregatedEntityIdentity['synapses'] = [];
  if (rootMolecule) {
    for (const syn of rootMolecule.outgoing) {
      synapses.push({
        linkId: syn.linkId,
        relationType: syn.relationType,
        neighbor: syn.atom,
        direction: 'outgoing',
      });
    }
    for (const syn of rootMolecule.incoming) {
      synapses.push({
        linkId: syn.linkId,
        relationType: syn.relationType,
        neighbor: syn.atom,
        direction: 'incoming',
      });
    }
  }

  return {
    primaryName,
    phones: Array.from(phoneSet),
    emails: Array.from(emailSet),
    documents: Array.from(docMap.values()),
    locations: Array.from(locMap.values()),
    tasks,
    notes,
    documentsClusters,
    events,
    allConnected: connectedMolecules,
    synapses,
  };
}
