'use client';

import type { KanbanColumnId } from '@/modules/codex/domain/services/viewHelpers';
import type { Atom, MolecularProjection } from '@/modules/codex/domain/types';
import { Check, Clock, FileText, Hash, Inbox, Network, Trash2, User } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { groupMoleculesByKanbanStatus, KANBAN_COLUMNS } from '@/modules/codex/domain/services/viewHelpers';

export type MolecularKanbanBoardProps = {
  molecules: MolecularProjection[];
  activeFilterAtomId?: string | null;
  onStatusChange?: (atomId: string, newStatus: KanbanColumnId) => void;
  onFilterByAtom?: (atom: Atom) => void;
  onOpenDetail?: (atomId: string) => void;
  onDelete?: (atomId: string) => void;
};

export const MolecularKanbanBoard: React.FC<MolecularKanbanBoardProps> = ({
  activeFilterAtomId,
  molecules,
  onDelete,
  onFilterByAtom,
  onOpenDetail,
  onStatusChange,
}) => {
  const [draggedAtomId, setDraggedAtomId] = useState<string | null>(null);
  const [activeDropCol, setActiveDropCol] = useState<KanbanColumnId | null>(null);

  const columns = useMemo(() => {
    return groupMoleculesByKanbanStatus(molecules);
  }, [molecules]);

  const handleDragStart = (e: React.DragEvent, atomId: string) => {
    e.dataTransfer.setData('text/plain', atomId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedAtomId(atomId);
  };

  const handleDragOver = (e: React.DragEvent, colId: KanbanColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropCol !== colId) {
      setActiveDropCol(colId);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, colId: KanbanColumnId) => {
    if (activeDropCol === colId) {
      setActiveDropCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColId: KanbanColumnId) => {
    e.preventDefault();
    setActiveDropCol(null);
    const atomId = e.dataTransfer.getData('text/plain') || draggedAtomId;
    if (atomId && onStatusChange) {
      onStatusChange(atomId, targetColId);
    }
    setDraggedAtomId(null);
  };

  return (
    <div className="
      grid grid-cols-1 gap-4
      md:grid-cols-3
    "
    >
      {KANBAN_COLUMNS.map((col) => {
        const colMolecules = columns[col.id] ?? [];
        const isDropTarget = activeDropCol === col.id;

        return (
          <div
            key={col.id}
            onDragOver={e => handleDragOver(e, col.id)}
            onDragLeave={e => handleDragLeave(e, col.id)}
            onDrop={e => handleDrop(e, col.id)}
            className={`
              flex flex-col rounded-2xl border bg-muted/30 p-3 transition-colors
              ${col.borderColor}
              ${
          isDropTarget
            ? 'border-primary/60 bg-primary/5 ring-2 ring-primary/20'
            : ''
          }
            `}
          >
            {/* Cabecera de la columna */}
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span
                  className={`
                    rounded-full border px-2.5 py-0.5 text-xs font-semibold
                    ${col.badgeColor}
                  `}
                >
                  {col.title}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {colMolecules.length}
                </span>
              </div>
            </div>

            {/* Tarjetas de la columna */}
            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
              {colMolecules.length === 0
                ? (
                    <div className="
                      flex flex-1 items-center justify-center rounded-xl border
                      border-dashed border-border/60 p-6 text-center text-xs
                      text-muted-foreground/60
                    "
                    >
                      {col.emptyText}
                    </div>
                  )
                : (
                    colMolecules.map((mol) => {
                      const { incoming, outgoing, root } = mol;
                      const payload = (root.payload ?? {}) as Record<string, unknown>;
                      const title = String(payload.title ?? payload.name ?? root.type);
                      const isTask = root.type === 'task';
                      const dueDateStr = typeof payload.dueDate === 'string' ? payload.dueDate : null;

                      // Vecinos únicos
                      const neighborsMap = new Map<string, Atom>();
                      for (const syn of outgoing) {
                        neighborsMap.set(syn.atom.id, syn.atom);
                      }
                      for (const syn of incoming) {
                        neighborsMap.set(syn.atom.id, syn.atom);
                      }
                      const uniqueNeighbors = Array.from(neighborsMap.values());

                      return (
                        <div
                          key={root.id}
                          draggable
                          onDragStart={e => handleDragStart(e, root.id)}
                          className="
                            group cursor-grab rounded-xl border border-border/80
                            bg-card p-3 shadow-2xs transition-all
                            hover:border-primary/40 hover:shadow-sm
                            active:cursor-grabbing
                          "
                        >
                          {/* Título y acciones */}
                          <div className="
                            flex items-start justify-between gap-2
                          "
                          >
                            <span
                              onClick={() => onOpenDetail?.(root.id)}
                              className="
                                cursor-pointer text-sm font-medium
                                text-foreground transition-colors
                                hover:text-primary
                              "
                            >
                              {title}
                            </span>
                            <div className="
                              flex items-center gap-1 opacity-0
                              transition-opacity
                              group-hover:opacity-100
                            "
                            >
                              {onOpenDetail && (
                                <button
                                  type="button"
                                  onClick={() => onOpenDetail(root.id)}
                                  className="
                                    rounded-sm p-1 text-muted-foreground
                                    hover:bg-accent hover:text-foreground
                                  "
                                  title="Ver detalle molecular"
                                >
                                  <Network className="size-3.5" />
                                </button>
                              )}
                              {onDelete && (
                                <button
                                  type="button"
                                  onClick={() => onDelete(root.id)}
                                  className="
                                    rounded-sm p-1 text-muted-foreground
                                    hover:bg-destructive/10
                                    hover:text-destructive
                                  "
                                  title="Eliminar átomo"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Tipo y Fecha de Vencimiento */}
                          <div className="
                            mt-2 flex flex-wrap items-center gap-1.5 text-xs
                          "
                          >
                            <span className="
                              inline-flex items-center gap-1 rounded-sm
                              bg-secondary px-1.5 py-0.5 text-[10px] font-medium
                              text-secondary-foreground
                            "
                            >
                              {isTask
                                ? <Check className="size-2.5" />
                                : root.type === 'note'
                                  ? <FileText className="size-2.5" />
                                  : <Inbox className="size-2.5" />}
                              {root.type}
                            </span>

                            {dueDateStr && (
                              <span className="
                                inline-flex items-center gap-1 rounded-full
                                border border-border px-1.5 py-0.5 text-[10px]
                                font-medium text-muted-foreground
                              "
                              >
                                <Clock className="size-2.5" />
                                {new Date(dueDateStr).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            )}
                          </div>

                          {/* Chips Sinápticos */}
                          {uniqueNeighbors.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {uniqueNeighbors.map((atom) => {
                                const nPayload = (atom.payload ?? {}) as Record<string, unknown>;
                                const nName = typeof nPayload.name === 'string'
                                  ? nPayload.name
                                  : typeof nPayload.title === 'string'
                                    ? nPayload.title
                                    : atom.id;

                                const isEntity = ['client', 'contact', 'person', 'provider', 'employee', 'entity'].includes(atom.type);
                                const isActive = atom.id === activeFilterAtomId;

                                return (
                                  <button
                                    key={atom.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onFilterByAtom?.(atom);
                                    }}
                                    title={isActive ? `Quitar filtro de ${nName}` : `Filtrar por ${nName}`}
                                    className={`
                                      inline-flex items-center gap-0.5
                                      rounded-sm px-1.5 py-0.5 text-[10px]
                                      font-medium transition-all
                                      hover:scale-105
                                      ${
                                  isActive
                                    ? `
                                      border border-primary bg-primary
                                      text-primary-foreground shadow-xs ring-2
                                      ring-primary/40
                                    `
                                    : isEntity
                                      ? `
                                        bg-purple-500/10 text-purple-700
                                        dark:text-purple-300
                                      `
                                      : `
                                        bg-sky-500/10 text-sky-700
                                        dark:text-sky-300
                                      `
                                  }
                                    `}
                                  >
                                    {isEntity
                                      ? <User className="size-2.5" />
                                      : <Hash className="size-2.5" />}
                                    {nName}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Control accesible para mover a otra columna (móvil y teclado) */}
                          <div className="
                            mt-2.5 flex items-center justify-between border-t
                            border-border/40 pt-2 text-[11px]
                            text-muted-foreground
                          "
                          >
                            <span className="text-[10px] opacity-70">Mover:</span>
                            <div className="flex items-center gap-1">
                              {col.id !== 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => onStatusChange?.(root.id, 'pending')}
                                  className="
                                    rounded-sm px-1.5 py-0.5 text-[10px]
                                    font-medium
                                    hover:bg-accent hover:text-foreground
                                  "
                                >
                                  Pendiente
                                </button>
                              )}
                              {col.id !== 'in_progress' && (
                                <button
                                  type="button"
                                  onClick={() => onStatusChange?.(root.id, 'in_progress')}
                                  className="
                                    rounded-sm px-1.5 py-0.5 text-[10px]
                                    font-medium
                                    hover:bg-accent hover:text-foreground
                                  "
                                >
                                  En curso
                                </button>
                              )}
                              {col.id !== 'done' && (
                                <button
                                  type="button"
                                  onClick={() => onStatusChange?.(root.id, 'done')}
                                  className="
                                    rounded-sm px-1.5 py-0.5 text-[10px]
                                    font-medium text-emerald-600
                                    hover:bg-emerald-500/10
                                  "
                                >
                                  Completar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
