'use client';

import type { Atom, MolecularProjection } from '@/modules/codex/domain/types';
import { Calendar, Check, FileText, Hash, Inbox, Network, Trash2, User } from 'lucide-react';
import React from 'react';

export type MoleculeCardProps = {
  molecule: MolecularProjection;
  onToggleStatus?: (atomId: string, currentStatus: string) => void;
  onFilterByAtom?: (atom: Atom) => void;
  onOpenDetail?: (atomId: string) => void;
  onDelete?: (atomId: string) => void;
};

export const MoleculeCard: React.FC<MoleculeCardProps> = ({
  molecule,
  onDelete,
  onFilterByAtom,
  onOpenDetail,
  onToggleStatus,
}) => {
  const { incoming, outgoing, root } = molecule;
  const payload = (root.payload ?? {}) as Record<string, unknown>;

  const title = String(payload.title ?? payload.name ?? root.type);
  const status = typeof payload.status === 'string' ? payload.status : 'pending';
  const isDone = status === 'done';

  const isTask = root.type === 'task';
  const isNote = root.type === 'note';
  const isInbox = root.type === 'inbox';

  const dueDateStr = typeof payload.dueDate === 'string' ? payload.dueDate : null;
  const dueInfo = React.useMemo(() => {
    if (!dueDateStr) {
      return null;
    }
    const due = new Date(dueDateStr);
    if (Number.isNaN(due.getTime())) {
      return null;
    }

    const now = new Date();
    const isOverdue = due.getTime() < now.getTime() && !isDone;
    const isToday = due.toDateString() === now.toDateString();

    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let label = '';
    if (isToday) {
      label = `Hoy ${due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      label = `Mañana ${due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === -1) {
      label = 'Ayer';
    } else {
      label = due.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }

    return { label, isOverdue, isToday };
  }, [dueDateStr, isDone]);

  // Recopilar vecinos únicos por ID para no duplicar chips
  const neighbors = React.useMemo(() => {
    const map = new Map<string, Atom>();
    for (const syn of outgoing) {
      map.set(syn.atom.id, syn.atom);
    }
    for (const syn of incoming) {
      map.set(syn.atom.id, syn.atom);
    }
    return Array.from(map.values());
  }, [outgoing, incoming]);

  const entityNeighbors = neighbors.filter(atom =>
    ['client', 'contact', 'person', 'provider', 'employee', 'entity'].includes(atom.type),
  );

  const contextNeighbors = neighbors.filter(atom =>
    ['tag', 'project', 'topic', 'context'].includes(atom.type),
  );

  return (
    <div
      className={`
        group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-xs
        transition-all
        hover:border-primary/40 hover:shadow-md
        ${
    isDone ? 'bg-muted/40 opacity-70' : ''
    }
      `}
    >
      {/* Botón de estado para tareas o icono representativo */}
      <div className="pt-0.5">
        {isTask
          ? (
              <button
                type="button"
                onClick={() => onToggleStatus?.(root.id, status)}
                className={`
                  flex size-5 items-center justify-center rounded-md border
                  transition-all
                  ${
              isDone
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : `
                  border-muted-foreground/40
                  hover:border-primary hover:bg-primary/10
                `
              }
                `}
                aria-label={isDone ? 'Marcar tarea como pendiente' : 'Marcar tarea como completada'}
              >
                {isDone && <Check className="size-3.5 stroke-3" />}
              </button>
            )
          : isNote
            ? (
                <div className="
                  flex size-5 items-center justify-center text-amber-500
                "
                >
                  <FileText className="size-4" />
                </div>
              )
            : (
                <div className="
                  flex size-5 items-center justify-center text-slate-400
                "
                >
                  <Inbox className="size-4" />
                </div>
              )}
      </div>

      {/* Contenido principal */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenDetail?.(root.id)}
            className={`
              text-left text-base font-medium wrap-break-word text-foreground
              transition-all
              hover:text-primary hover:underline
              ${
    isDone ? 'text-muted-foreground line-through' : ''
    }
            `}
          >
            {title}
          </button>

          {/* Badge del tipo de átomo si no es tarea */}
          {!isTask && (
            <span className="
              rounded-md bg-secondary px-1.5 py-0.5 text-xs font-semibold
              text-secondary-foreground
            "
            >
              {isNote ? 'Nota' : isInbox ? 'Inbox' : root.type}
            </span>
          )}

          {/* Badge de fecha límite */}
          {dueInfo && (
            <span
              className={`
                inline-flex items-center gap-1 rounded-full border px-2 py-0.5
                text-xs font-medium
                ${
            isDone
              ? 'border-border text-muted-foreground'
              : dueInfo.isOverdue
                ? `
                  border-red-200 bg-red-50 text-red-700
                  dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300
                `
                : dueInfo.isToday
                  ? `
                    border-amber-200 bg-amber-50 text-amber-800
                    dark:border-amber-900/50 dark:bg-amber-950/40
                    dark:text-amber-300
                  `
                  : `
                    border-emerald-200 bg-emerald-50 text-emerald-800
                    dark:border-emerald-900/50 dark:bg-emerald-950/40
                    dark:text-emerald-300
                  `
            }
              `}
            >
              <Calendar className="size-3" />
              {dueInfo.label}
            </span>
          )}
        </div>

        {/* Sinapsis moleculares: Entidades (@) y Contextos (#) */}
        {(entityNeighbors.length > 0 || contextNeighbors.length > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {entityNeighbors.map((atom) => {
              const name = (atom.payload as { name?: string })?.name ?? atom.type;
              return (
                <button
                  key={atom.id}
                  type="button"
                  onClick={() => onFilterByAtom?.(atom)}
                  className="
                    inline-flex items-center gap-1 rounded-md border
                    border-purple-200 bg-purple-50 px-2 py-0.5 text-xs
                    font-medium text-purple-700 transition-colors
                    hover:bg-purple-100
                    dark:border-purple-900/50 dark:bg-purple-950/50
                    dark:text-purple-300
                    dark:hover:bg-purple-900/70
                  "
                  title={`Filtrar por @${name}`}
                >
                  <User className="size-3 opacity-70" />
                  @
                  {name}
                </button>
              );
            })}

            {contextNeighbors.map((atom) => {
              const name = (atom.payload as { name?: string })?.name ?? atom.type;
              return (
                <button
                  key={atom.id}
                  type="button"
                  onClick={() => onFilterByAtom?.(atom)}
                  className="
                    inline-flex items-center gap-1 rounded-md border
                    border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium
                    text-blue-700 transition-colors
                    hover:bg-blue-100
                    dark:border-blue-900/50 dark:bg-blue-950/50
                    dark:text-blue-300
                    dark:hover:bg-blue-900/70
                  "
                  title={`Filtrar por #${name}`}
                >
                  <Hash className="size-3 opacity-70" />
                  #
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Acciones contextuales */}
      <div className="
        flex items-center gap-1 opacity-0 transition-opacity
        group-hover:opacity-100
        focus-within:opacity-100
      "
      >
        {onOpenDetail && (
          <button
            type="button"
            onClick={() => onOpenDetail(root.id)}
            className="
              rounded-md p-1.5 text-muted-foreground transition-colors
              hover:bg-accent hover:text-foreground
            "
            aria-label="Explorar red sináptica"
            title="Explorar red sináptica"
          >
            <Network className="size-4" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(root.id)}
            className="
              rounded-md p-1.5 text-muted-foreground transition-colors
              hover:bg-red-50 hover:text-red-600
              dark:hover:bg-red-950/50 dark:hover:text-red-400
            "
            aria-label="Eliminar átomo"
            title="Eliminar átomo"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
};
