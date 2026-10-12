'use client';

import type { Atom, MolecularProjection } from '@/modules/codex/domain/types';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Inbox,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  getMonthLabel,
  groupMoleculesByDate,
} from '@/modules/codex/domain/services/viewHelpers';

export type MolecularCalendarViewProps = {
  molecules: MolecularProjection[];
  activeFilterAtomId?: string | null;
  onFilterByAtom?: (atom: Atom) => void;
  onOpenDetail?: (atomId: string) => void;
};

const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const MolecularCalendarView: React.FC<MolecularCalendarViewProps> = ({
  activeFilterAtomId: _activeFilterAtomId,
  molecules,
  onFilterByAtom: _onFilterByAtom,
  onOpenDetail,
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const { days, unscheduled } = useMemo(() => {
    return groupMoleculesByDate(molecules, currentYear, currentMonth);
  }, [molecules, currentYear, currentMonth]);

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
      {/* Controles de Navegación del Calendario */}
      <div className="
        flex flex-wrap items-center justify-between gap-3 rounded-2xl border
        border-border bg-card p-3 shadow-2xs
      "
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            {monthLabel}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
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
      </div>

      {/* Cuadrícula de Calendario */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
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

                    return (
                      <button
                        key={mol.root.id}
                        type="button"
                        onClick={() => onOpenDetail?.(mol.root.id)}
                        className={`
                          group flex items-center gap-1 rounded-md border
                          border-border/60 bg-muted/40 px-1.5 py-0.5 text-left
                          text-[11px] transition-all
                          hover:border-primary/50 hover:bg-accent
                          ${isDone ? 'line-through opacity-50' : ''}
                        `}
                        title={title}
                      >
                        <span className="shrink-0">
                          {isDone
                            ? <Check className="size-2.5 text-emerald-600" />
                            : mol.root.type === 'task'
                              ? <Clock className="size-2.5 text-amber-500" />
                              : <FileText className="size-2.5 text-sky-500" />}
                        </span>
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

      {/* Panel de Elementos No Programados (Sin Fecha de Vencimiento) */}
      {unscheduled.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="
              flex items-center gap-1.5 text-sm font-semibold text-foreground
            "
            >
              <CalendarIcon className="size-4 text-muted-foreground" />
              Sin fecha asignada (
              {unscheduled.length}
              )
            </h4>
            <span className="text-xs text-muted-foreground">
              Haz clic en cualquier elemento para inspeccionar o asignar fecha
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
                      ? <Check className="size-3 text-muted-foreground" />
                      : mol.root.type === 'note'
                        ? <FileText className="size-3 text-amber-500" />
                        : <Inbox className="size-3 text-sky-500" />}
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
