'use client';

import type { KanbanColumnId } from '@/libs/biology/viewHelpers';
import type { Atom, MolecularProjection } from '@/types/biology';
import {
  Check,
  Clock,
  FileText,
  Hash,
  Inbox,
  Network,
  Trash2,
  User,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  groupMoleculesByKanbanStatus,
  KANBAN_COLUMNS,
} from '@/libs/biology/viewHelpers';

export type MolecularKanbanBoardProps = {
  molecules: MolecularProjection[];
  onStatusChange?: (atomId: string, nextStatus: KanbanColumnId) => void;
  onDelete?: (atomId: string) => void;
  onFilterByAtom?: (atom: Atom) => void;
  onOpenDetail?: (atomId: string) => void;
};

export const MolecularKanbanBoard: React.FC<MolecularKanbanBoardProps> = ({
  molecules,
  onDelete,
  onFilterByAtom,
  onOpenDetail,
  onStatusChange,
}) => {
  const [draggedAtomId, setDraggedAtomId] = useState<string | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<KanbanColumnId | null>(null);

  const grouped = groupMoleculesByKanbanStatus(molecules);

  const handleDragStart = (e: React.DragEvent, atomId: string) => {
    e.dataTransfer.setData('text/plain', atomId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedAtomId(atomId);
  };

  const handleDragEnd = () => {
    setDraggedAtomId(null);
    setActiveDropColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: KanbanColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropColumn !== colId) {
      setActiveDropColumn(colId);
    }
  };

  const handleDragLeave = (colId: KanbanColumnId) => {
    if (activeDropColumn === colId) {
      setActiveDropColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, colId: KanbanColumnId) => {
    e.preventDefault();
    const atomId = e.dataTransfer.getData('text/plain') || draggedAtomId;
    if (atomId) {
      onStatusChange?.(atomId, colId);
    }
    setDraggedAtomId(null);
    setActiveDropColumn(null);
  };

  return (
    <div className="
      grid grid-cols-1 gap-4
      lg:grid-cols-3
    "
    >
      {KANBAN_COLUMNS.map((col) => {
        const columnMolecules = grouped[col.id] ?? [];
        const isTarget = activeDropColumn === col.id;

        return (
          <div
            key={col.id}
            onDragOver={e => handleDragOver(e, col.id)}
            onDragLeave={() => handleDragLeave(col.id)}
            onDrop={e => handleDrop(e, col.id)}
            className={`
              flex flex-col rounded-2xl border bg-card/60 p-3.5 transition-all
              ${
          isTarget
            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
            : 'border-border'
          }
            `}
          >
            {/* Cabecera de Columna */}
            <div className="
              mb-3 flex items-center justify-between border-b border-border/60
              pb-2
            "
            >
              <div className="flex items-center gap-2">
                <span
                  className={`
                    rounded-md border px-2 py-0.5 text-xs font-semibold
                    ${col.badgeColor}
                  `}
                >
                  {col.title}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  {columnMolecules.length}
                </span>
              </div>
            </div>

            {/* Lista de Tarjetas */}
            <div className="flex min-h-[300px] flex-1 flex-col gap-2.5">
              {columnMolecules.length === 0
                ? (
                    <div className="
                      flex flex-1 flex-col items-center justify-center
                      rounded-xl border border-dashed border-border/80 p-6
                      text-center text-xs text-muted-foreground
                    "
                    >
                      <p>{col.emptyText}</p>
                    </div>
                  )
                : (
                    columnMolecules.map((mol) => {
                      const root = mol.root;
                      const payload = (root.payload ?? {}) as Record<string, unknown>;
                      const title = typeof payload.title === 'string'
                        ? payload.title
                        : typeof payload.content === 'string'
                          ? payload.content
                          : typeof payload.name === 'string'
                            ? payload.name
                            : 'Sin título';

                      const dueDateStr = typeof payload.dueDate === 'string' ? payload.dueDate : null;
                      const isTask = root.type === 'task';
                      const isDragging = draggedAtomId === root.id;

                      // Vecinos únicos
                      const neighbors = [
                        ...mol.outgoing.map(s => s.atom),
                        ...mol.incoming.map(s => s.atom),
                      ];
                      const uniqueNeighbors = Array.from(
                        new Map(neighbors.map(n => [n.id, n])).values(),
                      );

                      return (
                        <div
                          key={root.id}
                          draggable
                          onDragStart={e => handleDragStart(e, root.id)}
                          onDragEnd={handleDragEnd}
                          className={`
                            group relative cursor-grab rounded-xl border
                            border-border bg-card p-3 shadow-xs transition-all
                            hover:border-primary/50 hover:shadow-sm
                            active:cursor-grabbing
                            ${isDragging ? 'opacity-40 ring-2 ring-primary' : ''}
                          `}
                        >
                          <div className="
                            flex items-start justify-between gap-2
                          "
                          >
                            <button
                              type="button"
                              onClick={() => onOpenDetail?.(root.id)}
                              className="
                                line-clamp-2 text-left text-sm font-semibold
                                text-foreground transition-colors
                                hover:text-primary
                              "
                            >
                              {title}
                            </button>

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

                                const isEntity = ['client', 'contact', 'person'].includes(atom.type);

                                return (
                                  <button
                                    key={atom.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onFilterByAtom?.(atom);
                                    }}
                                    className={`
                                      inline-flex items-center gap-0.5
                                      rounded-sm px-1.5 py-0.5 text-[10px]
                                      font-medium transition-all
                                      hover:scale-105
                                      ${
                                  isEntity
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
