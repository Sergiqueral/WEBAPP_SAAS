'use client';

import type { Atom } from '@/types/biology';
import { Filter, Hash, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

type ContextFilterBarProps = {
  activeFilterAtom: Atom | null;
  onClearFilter: () => void;
  onSelectFilter: (atom: { id: string; name: string; type: string }) => void;
};

export const ContextFilterBar: React.FC<ContextFilterBarProps> = ({
  activeFilterAtom,
  onClearFilter,
  onSelectFilter,
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
    <div className="
      mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card/60 p-2.5
      backdrop-blur-xs
    "
    >
      <div className="
        flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wider
        text-muted-foreground uppercase
      "
      >
        <Filter className="size-3.5" />
        <span>Filtro Grafo:</span>
      </div>

      {activeFilterAtom
        ? (
            <div className="
              flex items-center gap-1.5 rounded-lg border border-primary/30
              bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary
            "
            >
              {isEntity
                ? <User className="size-3.5" />
                : (
                    <Hash className="size-3.5" />
                  )}
              <span>{isEntity ? `@${activeName}` : `#${activeName}`}</span>
              <button
                type="button"
                onClick={onClearFilter}
                className="
                  ml-1 rounded-sm p-0.5 transition-colors
                  hover:bg-primary/20 hover:text-primary
                "
                title="Quitar filtro"
                aria-label="Quitar filtro"
              >
                <X className="size-3" />
              </button>
            </div>
          )
        : (
            <div className="
              flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5
            "
            >
              {entities.slice(0, 5).map(item => (
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
                >
                  <User className="size-3 opacity-60" />
                  @
                  {item.name}
                </button>
              ))}

              {contexts.slice(0, 5).map(item => (
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
                >
                  <Hash className="size-3 opacity-60" />
                  #
                  {item.name}
                </button>
              ))}
            </div>
          )}
    </div>
  );
};
