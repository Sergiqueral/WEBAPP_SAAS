'use client';

import type { Atom, MolecularProjection } from '@/modules/codex/domain/types';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Inbox,
  List,
  MapPin,
  Phone,
  User,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  extractTemporalDimension,
  getMonthLabel,
  groupMoleculesByDate,
  groupMoleculesForAgenda,
} from '@/modules/codex/domain/services/viewHelpers';

export type MolecularCalendarViewProps = {
  molecules: MolecularProjection[];
  activeFilterAtomId?: string | null;
  onFilterByAtom?: (atom: Atom) => void;
  onOpenDetail?: (atomId: string) => void;
};

const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getLinkedClientInfo(molecule: MolecularProjection): {
  clientName: string | null;
  phone: string | null;
  location: string | null;
} {
  let clientName: string | null = null;
  let phone: string | null = null;
  let location: string | null = null;

  const allNeighbors = [
    ...molecule.outgoing.map(s => ({ atom: s.atom, rel: s.relationType })),
    ...molecule.incoming.map(s => ({ atom: s.atom, rel: s.relationType })),
  ];

  for (const item of allNeighbors) {
    if (['client', 'person', 'contact'].includes(item.atom.type)) {
      const p = (item.atom.payload ?? {}) as Record<string, unknown>;
      clientName = (p.name as string) || (p.title as string) || clientName;
      if (Array.isArray(p.phones) && p.phones.length > 0) {
        phone = p.phones[0] as string;
      } else if (typeof p.phone === 'string') {
        phone = p.phone;
      }
      if (Array.isArray(p.locations) && p.locations.length > 0) {
        const loc = p.locations[0] as { normalized?: string } | string;
        location = typeof loc === 'string' ? loc : loc.normalized ?? location;
      }
    } else if (item.atom.type === 'anchor_phone' && !phone) {
      phone = (item.atom.payload?.name as string) || (item.atom.payload?.phone as string);
    } else if (item.atom.type === 'anchor_location' && !location) {
      location = (item.atom.payload?.normalized as string) || (item.atom.payload?.name as string);
    }
  }

  if (!location) {
    const rootPayload = (molecule.root.payload ?? {}) as Record<string, unknown>;
    if (Array.isArray(rootPayload.locations) && rootPayload.locations.length > 0) {
      const loc = rootPayload.locations[0] as { normalized?: string } | string;
      location = typeof loc === 'string' ? loc : loc.normalized ?? null;
    }
  }

  return { clientName, phone, location };
}

export const MolecularCalendarView: React.FC<MolecularCalendarViewProps> = ({
  activeFilterAtomId: _activeFilterAtomId,
  molecules,
  onFilterByAtom: _onFilterByAtom,
  onOpenDetail,
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Sub-modo de vista: Cuadrícula Mensual vs Agenda Cronológica
  const [calendarSubMode, setCalendarSubMode] = useState<'month' | 'agenda'>('month');

  // Filtros dinámicos
  const [typeFilter, setTypeFilter] = useState<'all' | 'event' | 'task' | 'note'>('all');
  const [hideCompleted, setHideCompleted] = useState(false);

  // Filtrado reactivo de moléculas
  const filteredMolecules = useMemo(() => {
    return molecules.filter((mol) => {
      if (typeFilter !== 'all') {
        if (typeFilter === 'event' && mol.root.type !== 'event') {
          return false;
        }
        if (typeFilter === 'task' && mol.root.type !== 'task') {
          return false;
        }
        if (typeFilter === 'note' && mol.root.type !== 'note') {
          return false;
        }
      }
      if (hideCompleted) {
        const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
        if (payload.status === 'done') {
          return false;
        }
      }
      return true;
    });
  }, [molecules, typeFilter, hideCompleted]);

  // Agrupación mensual
  const { days, unscheduled: unscheduledMonth } = useMemo(() => {
    return groupMoleculesByDate(filteredMolecules, currentYear, currentMonth);
  }, [filteredMolecules, currentYear, currentMonth]);

  // Agrupación para agenda
  const { groups: agendaGroups, unscheduled: unscheduledAgenda } = useMemo(() => {
    return groupMoleculesForAgenda(filteredMolecules);
  }, [filteredMolecules]);

  const unscheduled = calendarSubMode === 'month' ? unscheduledMonth : unscheduledAgenda;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const monthLabel = getMonthLabel(currentYear, currentMonth, 'es-ES');

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de Controles y Filtros del Calendario */}
      <div className="
        flex flex-wrap items-center justify-between gap-3 rounded-2xl border
        border-border bg-card p-3 shadow-2xs
      "
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              {calendarSubMode === 'month' ? monthLabel : 'Agenda Cronológica'}
            </h3>
          </div>

          {/* Toggle Mes vs Agenda */}
          <div className="
            flex items-center rounded-xl border border-border bg-muted/60 p-0.5
          "
          >
            <button
              type="button"
              onClick={() => setCalendarSubMode('month')}
              className={`
                flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs
                font-medium transition-all
                ${
    calendarSubMode === 'month'
      ? 'bg-background text-foreground shadow-2xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              <CalendarIcon className="size-3.5" />
              <span className="
                hidden
                sm:inline
              "
              >
                Mes
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCalendarSubMode('agenda')}
              className={`
                flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs
                font-medium transition-all
                ${
    calendarSubMode === 'agenda'
      ? 'bg-background text-foreground shadow-2xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              <List className="size-3.5" />
              <span className="
                hidden
                sm:inline
              "
              >
                Agenda
              </span>
            </button>
          </div>
        </div>

        {/* Filtros de Tipo y Estado */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por tipo de átomo */}
          <div className="
            flex items-center gap-1 rounded-xl border border-border bg-muted/40
            p-1 text-xs
          "
          >
            <Filter className="ml-1 size-3 text-muted-foreground" />
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`
                rounded-md px-2 py-0.5 font-medium transition-colors
                ${
    typeFilter === 'all'
      ? 'bg-background text-foreground shadow-2xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              Todo
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('event')}
              className={`
                rounded-md px-2 py-0.5 font-medium transition-colors
                ${
    typeFilter === 'event'
      ? 'bg-background text-foreground shadow-2xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              Citas
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('task')}
              className={`
                rounded-md px-2 py-0.5 font-medium transition-colors
                ${
    typeFilter === 'task'
      ? 'bg-background text-foreground shadow-2xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              Tareas
            </button>
          </div>

          {/* Ocultar completados */}
          <button
            type="button"
            onClick={() => setHideCompleted(prev => !prev)}
            className={`
              rounded-xl border border-border px-2.5 py-1 text-xs font-medium
              transition-colors
              ${
    hideCompleted
      ? 'border-primary/30 bg-primary/10 text-primary'
      : `
        bg-muted/30 text-muted-foreground
        hover:text-foreground
      `
    }
            `}
          >
            {hideCompleted ? 'Completadas ocultas' : 'Ver todo'}
          </button>

          {/* Navegación de Mes (solo en modo mes) */}
          {calendarSubMode === 'month' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToday}
                className="
                  rounded-lg border border-border bg-card px-2.5 py-1 text-xs
                  font-medium text-foreground transition-colors
                  hover:bg-accent
                "
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="
                  rounded-lg border border-border bg-card p-1.5
                  text-muted-foreground transition-colors
                  hover:bg-accent hover:text-foreground
                "
                aria-label="Mes anterior"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="
                  rounded-lg border border-border bg-card p-1.5
                  text-muted-foreground transition-colors
                  hover:bg-accent hover:text-foreground
                "
                aria-label="Mes siguiente"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODO 1: CUADRÍCULA MENSUAL */}
      {calendarSubMode === 'month' && (
        <div className="
          overflow-hidden rounded-2xl border border-border bg-card
        "
        >
          {/* Cabecera de Días de la Semana */}
          <div className="
            grid grid-cols-7 border-b border-border bg-muted/40 text-center
            text-xs font-semibold text-muted-foreground
          "
          >
            {WEEKDAY_NAMES.map(dayName => (
              <div key={dayName} className="py-2.5">
                {dayName}
              </div>
            ))}
          </div>

          {/* Celdas de Días */}
          <div className="
            grid grid-cols-7 divide-x divide-y divide-border text-xs
          "
          >
            {days.map((day) => {
              const dayNumber = day.date.getDate();

              return (
                <div
                  key={day.dateKey}
                  className={`
                    min-h-[110px] p-2 transition-colors
                    ${
                day.isCurrentMonth
                  ? 'bg-card'
                  : 'bg-muted/10 text-muted-foreground/60'
                }
                    ${day.isToday ? 'bg-primary/5' : ''}
                  `}
                >
                  <div className="flex items-center justify-between pb-1">
                    <span
                      className={`
                        flex size-6 items-center justify-center rounded-full
                        font-semibold
                        ${
                day.isToday
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-foreground'
                }
                        ${!day.isCurrentMonth ? 'opacity-40' : ''}
                      `}
                    >
                      {dayNumber}
                    </span>

                    {day.molecules.length > 0 && (
                      <span className="
                        text-[10px] font-bold text-muted-foreground
                      "
                      >
                        {day.molecules.length}
                      </span>
                    )}
                  </div>

                  {/* Lista de partículas en el día */}
                  <div className="mt-1 flex flex-col gap-1">
                    {day.molecules.slice(0, 3).map((mol) => {
                      const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
                      const title = typeof payload.title === 'string'
                        ? payload.title
                        : typeof payload.content === 'string'
                          ? payload.content
                          : 'Sin título';

                      const isDone = payload.status === 'done';
                      const temporal = extractTemporalDimension(mol);

                      return (
                        <button
                          key={mol.root.id}
                          type="button"
                          onClick={() => onOpenDetail?.(mol.root.id)}
                          className={`
                            group flex items-center gap-1.5 rounded-md border
                            px-1.5 py-0.5 text-left text-[11px] transition-all
                            ${
                        temporal.isTentative
                          ? 'border-dashed border-amber-500/40 bg-amber-500/5'
                          : 'border-border/60 bg-muted/40'
                        }
                            hover:border-primary/50 hover:bg-accent
                            ${isDone ? 'line-through opacity-50' : ''}
                          `}
                          title={`${title}${temporal.timeLabel ? ` (${temporal.timeLabel})` : ''}`}
                        >
                          <span className="shrink-0">
                            {isDone
                              ? <Check className="size-2.5 text-emerald-600" />
                              : mol.root.type === 'event'
                                ? (
                                    <CalendarIcon className="
                                      size-2.5 text-sky-500
                                    "
                                    />
                                  )
                                : mol.root.type === 'task'
                                  ? <Clock className="size-2.5 text-amber-500" />
                                  : (
                                      <FileText className="
                                        size-2.5 text-purple-500
                                      "
                                      />
                                    )}
                          </span>

                          {temporal.hasTime && temporal.timeLabel && (
                            <span className="
                              font-mono text-[9px] font-semibold text-primary/80
                            "
                            >
                              {temporal.timeLabel}
                            </span>
                          )}

                          <span className="
                            truncate font-medium text-foreground
                            group-hover:text-primary
                          "
                          >
                            {title}
                          </span>
                        </button>
                      );
                    })}

                    {day.molecules.length > 3 && (
                      <span className="
                        pl-1 text-[10px] font-medium text-muted-foreground
                      "
                      >
                        +
                        {day.molecules.length - 3}
                        {' '}
                        más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODO 2: AGENDA CRONOLÓGICA (Feed Vertical / Mobile-First) */}
      {calendarSubMode === 'agenda' && (
        <div className="flex flex-col gap-4">
          {agendaGroups.length === 0
            ? (
                <div className="
                  rounded-2xl border border-border bg-card p-12 text-center
                "
                >
                  <CalendarIcon className="
                    mx-auto size-8 text-muted-foreground/60
                  "
                  />
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    No hay elementos agendados con los filtros actuales
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prueba cambiando los filtros o programa elementos desde la bandeja inferior.
                  </p>
                </div>
              )
            : (
                agendaGroups.map((group) => {
                  return (
                    <div key={group.dateKey} className="flex flex-col gap-2">
                      {/* Cabecera del Día */}
                      <div className="
                        flex items-center gap-2 border-b border-border/60 pt-2
                        pb-1.5
                      "
                      >
                        <span className={`
                          text-xs font-semibold
                          ${group.isToday ? 'text-primary' : 'text-foreground'}
                        `}
                        >
                          {group.label}
                        </span>
                        <span className="
                          rounded-full bg-muted px-1.5 py-0.5 text-[10px]
                          font-bold text-muted-foreground
                        "
                        >
                          {group.molecules.length}
                        </span>
                      </div>

                      {/* Tarjetas de Eventos del Día */}
                      <div className="flex flex-col gap-2">
                        {group.molecules.map(({ molecule: mol, temporal }) => {
                          const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
                          const title = typeof payload.title === 'string'
                            ? payload.title
                            : typeof payload.content === 'string'
                              ? payload.content
                              : 'Sin título';

                          const isDone = payload.status === 'done';
                          const { clientName, phone, location } = getLinkedClientInfo(mol);

                          return (
                            <div
                              key={mol.root.id}
                              className={`
                                group flex flex-wrap items-center
                                justify-between gap-3 rounded-2xl border p-3.5
                                transition-all
                                ${
                            temporal.isTentative
                              ? `
                                border-dashed border-amber-500/40 bg-amber-500/5
                              `
                              : 'border-border bg-card'
                            }
                                hover:border-primary/40 hover:shadow-2xs
                                ${isDone ? 'opacity-60' : ''}
                              `}
                            >
                              <div className="
                                flex min-w-0 flex-1 items-start gap-3
                              "
                              >
                                {/* Píldora de Hora / Todo el Día */}
                                <div className="
                                  flex shrink-0 flex-col items-center
                                  justify-center rounded-xl border border-border
                                  bg-muted/40 px-2.5 py-1.5 text-center
                                "
                                >
                                  <span className="
                                    font-mono text-xs font-bold text-foreground
                                  "
                                  >
                                    {temporal.hasTime && temporal.timeLabel
                                      ? temporal.timeLabel
                                      : 'Todo el día'}
                                  </span>
                                  {temporal.isTentative && (
                                    <span className="
                                      mt-0.5 text-[9px] font-bold text-amber-600
                                      dark:text-amber-400
                                    "
                                    >
                                      Tentativo
                                    </span>
                                  )}
                                </div>

                                {/* Título y Conexiones Moleculares */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="shrink-0">
                                      {mol.root.type === 'event'
                                        ? (
                                            <CalendarIcon className="
                                              size-4 text-sky-500
                                            "
                                            />
                                          )
                                        : mol.root.type === 'task'
                                          ? (
                                              <Clock className="
                                                size-4 text-amber-500
                                              "
                                              />
                                            )
                                          : (
                                              <FileText className="
                                                size-4 text-purple-500
                                              "
                                              />
                                            )}
                                    </span>
                                    <h4 className={`
                                      truncate text-sm font-semibold
                                      ${isDone
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground'}
                                    `}
                                    >
                                      {title}
                                    </h4>
                                  </div>

                                  {/* Metadatos Enlazados (Cliente, Teléfono, Ubicación) */}
                                  <div className="
                                    mt-1.5 flex flex-wrap items-center gap-3
                                    text-xs text-muted-foreground
                                  "
                                  >
                                    {clientName && (
                                      <div className="
                                        flex items-center gap-1 font-medium
                                        text-foreground/80
                                      "
                                      >
                                        <User className="
                                          size-3 text-muted-foreground
                                        "
                                        />
                                        <span>{clientName}</span>
                                      </div>
                                    )}

                                    {phone && (
                                      <a
                                        href={`tel:${phone}`}
                                        className="
                                          flex items-center gap-1 font-mono
                                          text-xs text-primary transition-colors
                                          hover:underline
                                        "
                                        title="Llamar directamente"
                                      >
                                        <Phone className="size-3" />
                                        <span>{phone}</span>
                                      </a>
                                    )}

                                    {location && (
                                      <a
                                        href={`https://maps.google.com/?q=${encodeURIComponent(location)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="
                                          flex items-center gap-1 text-xs
                                          text-muted-foreground
                                          transition-colors
                                          hover:text-foreground hover:underline
                                        "
                                        title="Abrir mapa"
                                      >
                                        <MapPin className="size-3 text-rose-500" />
                                        <span className="max-w-[200px] truncate">
                                          {location}
                                        </span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Botón de Inspección Molecular */}
                              {onOpenDetail && (
                                <button
                                  type="button"
                                  onClick={() => onOpenDetail(mol.root.id)}
                                  className="
                                    rounded-xl border border-border bg-card p-2
                                    text-muted-foreground transition-colors
                                    hover:bg-accent hover:text-foreground
                                  "
                                  title="Inspeccionar átomo"
                                >
                                  <ExternalLink className="size-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
        </div>
      )}

      {/* Panel de Elementos No Programados (Sin Fecha de Vencimiento) */}
      {unscheduled.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="
              flex items-center gap-1.5 text-sm font-semibold text-foreground
            "
            >
              <Inbox className="size-4 text-muted-foreground" />
              Sin fecha asignada (
              {unscheduled.length}
              )
            </h4>
            <span className="text-xs text-muted-foreground">
              Haz clic en cualquier elemento para inspeccionar o asignarle fecha
            </span>
          </div>

          <div className="
            grid grid-cols-1 gap-2
            sm:grid-cols-2
            md:grid-cols-3
          "
          >
            {unscheduled.slice(0, 9).map((mol) => {
              const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
              const title = typeof payload.title === 'string'
                ? payload.title
                : typeof payload.content === 'string'
                  ? payload.content
                  : 'Sin título';

              const isDone = payload.status === 'done';

              return (
                <button
                  key={mol.root.id}
                  type="button"
                  onClick={() => onOpenDetail?.(mol.root.id)}
                  className={`
                    flex items-center justify-between rounded-xl border
                    border-border bg-muted/20 p-2.5 text-left text-xs
                    transition-all
                    hover:border-primary/40 hover:bg-accent
                    ${isDone ? 'line-through opacity-60' : ''}
                  `}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {mol.root.type === 'task'
                      ? (
                          <Check className="size-3 text-muted-foreground" />
                        )
                      : mol.root.type === 'note'
                        ? (
                            <FileText className="size-3 text-amber-500" />
                          )
                        : (
                            <Inbox className="size-3 text-sky-500" />
                          )}
                    <span className="truncate font-medium text-foreground">
                      {title}
                    </span>
                  </div>
                  <span className="
                    shrink-0 text-[10px] font-medium text-muted-foreground
                    uppercase
                  "
                  >
                    {mol.root.type}
                  </span>
                </button>
              );
            })}
          </div>

          {unscheduled.length > 9 && (
            <div className="mt-2 text-center text-xs text-muted-foreground">
              y
              {' '}
              {unscheduled.length - 9}
              {' '}
              elementos más sin programar.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
