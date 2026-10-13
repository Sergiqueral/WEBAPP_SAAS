'use client';

import type { Atom } from '@/modules/codex/domain/types';
import { Filter, Hash, Sparkles, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

type ContextFilterBarProps = {
  activeFilterAtom: Atom | null;
  matchCount?: number;
  statusFilter?: 'all' | 'done' | 'pending';
  onStatusFilterChange?: (status: 'all' | 'done' | 'pending') => void;
  onClearFilter: () => void;
  onSelectFilter: (atom: { id: string; name: string; type: string }) => void;
  onOpenEntityLens?: (atom: Atom) => void;
};

export const ContextFilterBar: React.FC<ContextFilterBarProps> = ({
  activeFilterAtom,
  matchCount,
  onClearFilter,
  onOpenEntityLens,
  onSelectFilter,
  onStatusFilterChange,
  statusFilter,
}) => {
  const [entities, setEntities] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [contexts, setContexts] = useState<Array<{ id: string; name: string; type: string }>>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/omnibar/suggestions', { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) {
          return;
        }
        if (Array.isArray(data.entities)) {
          setEntities(data.entities.map((e: { id: string; name: string }) => ({ ...e, type: 'entity' })));
        }
        if (Array.isArray(data.contexts)) {
          setContexts(data.contexts.map((c: { id: string; name: string }) => ({ ...c, type: 'context' })));
        }
      })
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }, []);

  const activeName = (activeFilterAtom?.payload as { name?: string })?.name ?? activeFilterAtom?.type;
  const isEntity = activeFilterAtom && ['client', 'contact', 'person', 'provider', 'employee', 'entity'].includes(activeFilterAtom.type);

  if (!activeFilterAtom && entities.length === 0 && contexts.length === 0) {
    return null;
  }

  return (
    <div className={`
      mb-4 rounded-xl border p-2.5 transition-all
      ${
    activeFilterAtom
      ? 'border-primary/40 bg-primary/5 shadow-xs'
      : 'border-border/60 bg-card/60 backdrop-blur-xs'
    }
    `}
    >
      {activeFilterAtom
        ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="
                  flex items-center gap-1.5 rounded-lg border border-primary/30
                  bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary
                "
                >
                  {isEntity
                    ? <User className="size-3.5" />
                    : <Hash className="size-3.5" />}
                  <span>{isEntity ? `@${activeName}` : `#${activeName}`}</span>
                </div>

                {matchCount !== undefined && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {matchCount}
                    {' '}
                    {matchCount === 1 ? 'átomo conectado' : 'átomos conectados'}
                  </span>
                )}

                {/* Alternancia rápida de estado cuando el filtro está activo */}
                {onStatusFilterChange && statusFilter && (
                  <div className="
                    ml-2 flex items-center rounded-lg border bg-muted/60 p-0.5
                    text-[11px]
                  "
                  >
                    <button
                      type="button"
                      onClick={() => onStatusFilterChange('pending')}
                      className={`
                        rounded-md px-2 py-0.5 font-medium transition-all
                        ${
                  statusFilter === 'pending'
                    ? 'bg-background font-semibold text-foreground shadow-2xs'
                    : `
                      text-muted-foreground
                      hover:text-foreground
                    `
                  }
                      `}
                    >
                      Pendientes
                    </button>
                    <button
                      type="button"
                      onClick={() => onStatusFilterChange('all')}
                      className={`
                        rounded-md px-2 py-0.5 font-medium transition-all
                        ${
                  statusFilter === 'all'
                    ? 'bg-background font-semibold text-foreground shadow-2xs'
                    : `
                      text-muted-foreground
                      hover:text-foreground
                    `
                  }
                      `}
                    >
                      Todos
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEntity && onOpenEntityLens && activeFilterAtom && (
                  <button
                    type="button"
                    onClick={() => onOpenEntityLens(activeFilterAtom)}
                    className="
                      inline-flex items-center gap-1.5 rounded-lg border
                      border-primary/30 bg-primary/10 px-2.5 py-1 text-xs
                      font-semibold text-primary transition-colors
                      hover:bg-primary/20
                    "
                    title="Abrir Lente Molecular de este cliente"
                  >
                    <Sparkles className="size-3.5" />
                    <span>Ver Ficha de Cliente</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClearFilter}
                  className="
                    inline-flex items-center gap-1 rounded-lg border
                    border-border/80 bg-background px-2.5 py-1 text-xs
                    font-medium text-muted-foreground transition-colors
                    hover:bg-accent hover:text-foreground
                  "
                  title="Quitar filtro de grafo"
                >
                  <X className="size-3.5" />
                  <span>Quitar filtro</span>
                </button>
              </div>
            </div>
          )
        : (
            <div className="flex items-center gap-2 overflow-x-auto">
              <div className="
                flex shrink-0 items-center gap-1.5 px-1 text-xs font-semibold
                tracking-wider text-muted-foreground uppercase
              "
              >
                <Filter className="size-3.5" />
                <span>Explorar:</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                {entities.slice(0, 8).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectFilter(item)}
                    className="
                      inline-flex items-center gap-1 rounded-md border
                      border-purple-200/80 bg-purple-50/70 px-2 py-0.5 text-xs
                      font-medium text-purple-700 transition-colors
                      hover:bg-purple-100
                      dark:border-purple-900/40 dark:bg-purple-950/40
                      dark:text-purple-300
                      dark:hover:bg-purple-900/60
                    "
                    title={`Filtrar por @${item.name}`}
                  >
                    <User className="size-3 opacity-60" />
                    @
                    {item.name}
                  </button>
                ))}

                {contexts.slice(0, 8).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectFilter(item)}
                    className="
                      inline-flex items-center gap-1 rounded-md border
                      border-blue-200/80 bg-blue-50/70 px-2 py-0.5 text-xs
                      font-medium text-blue-700 transition-colors
                      hover:bg-blue-100
                      dark:border-blue-900/40 dark:bg-blue-950/40
                      dark:text-blue-300
                      dark:hover:bg-blue-900/60
                    "
                    title={`Filtrar por #${item.name}`}
                  >
                    <Hash className="size-3 opacity-60" />
                    #
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
    </div>
  );
};
