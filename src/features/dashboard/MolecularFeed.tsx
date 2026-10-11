'use client';

import type { Atom, MolecularProjection } from '@/types/biology';
import { CheckCircle2, FileText, Inbox, Layers, ListTodo, Plus, RefreshCw, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { ContextFilterBar } from './ContextFilterBar';
import { MoleculeCard } from './MoleculeCard';

type FeedTab = 'all' | 'inbox' | 'note' | 'task';
type StatusFilter = 'all' | 'done' | 'pending';

export const MolecularFeed: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [activeFilterAtom, setActiveFilterAtom] = useState<Atom | null>(null);

  const [molecules, setMolecules] = useState<MolecularProjection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMolecules = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('type', activeTab);
      params.set('status', statusFilter);
      if (activeFilterAtom?.id) {
        params.set('targetAtomId', activeFilterAtom.id);
      }

      const res = await fetch(`/api/v1/molecules?${params.toString()}`, { signal });
      if (!res.ok) {
        throw new Error('Error al cargar las moléculas');
      }

      const data = await res.json();
      setMolecules(data.molecules ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter, activeFilterAtom]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchMolecules(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchMolecules]);

  // Escuchar evento de ingesta desde la Omnibarra para actualización inmediata
  useEffect(() => {
    const handleIngested = (event: Event) => {
      const customEvent = event as CustomEvent<MolecularProjection>;
      if (customEvent.detail) {
        setMolecules(prev => [customEvent.detail, ...prev]);
      } else {
        void fetchMolecules();
      }
    };

    window.addEventListener('omnibar:molecule_ingested', handleIngested);
    return () => {
      window.removeEventListener('omnibar:molecule_ingested', handleIngested);
    };
  }, [fetchMolecules]);

  // Optimistic toggle status
  const handleToggleStatus = async (atomId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';

    // 1. Actualización optimista local
    setMolecules(prev =>
      prev.map((mol) => {
        if (mol.root.id === atomId) {
          const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
          return {
            ...mol,
            root: {
              ...mol.root,
              payload: { ...payload, status: nextStatus },
            },
          };
        }
        return mol;
      }),
    );

    // 2. Persistencia en backend
    try {
      const currentMolecule = molecules.find(m => m.root.id === atomId);
      const payload = (currentMolecule?.root.payload ?? {}) as Record<string, unknown>;

      const res = await fetch(`/api/v1/atoms/${atomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: { ...payload, status: nextStatus },
        }),
      });

      if (!res.ok) {
        throw new Error('Error al actualizar');
      }
    } catch {
      // Revertir optimismo en caso de error
      void fetchMolecules();
    }
  };

  // Optimistic delete
  const handleDelete = async (atomId: string) => {
    const backup = molecules;
    setMolecules(prev => prev.filter(m => m.root.id !== atomId));

    try {
      const res = await fetch(`/api/v1/atoms/${atomId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Error al eliminar');
      }
    } catch {
      setMolecules(backup);
    }
  };

  const openOmnibar = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      }),
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Barra superior de pestañas y controles */}
      <div className="
        flex flex-col gap-3
        sm:flex-row sm:items-center sm:justify-between
      "
      >
        {/* Selector de pestañas */}
        <div className="
          flex items-center gap-1 rounded-xl border bg-muted/60 p-1
        "
        >
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`
              inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
              font-medium transition-all
              ${
    activeTab === 'all'
      ? 'bg-background text-foreground shadow-xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
            `}
          >
            <Layers className="size-3.5" />
            <span>Todas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('task')}
            className={`
              inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
              font-medium transition-all
              ${
    activeTab === 'task'
      ? 'bg-background text-foreground shadow-xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
            `}
          >
            <ListTodo className="size-3.5" />
            <span>Tareas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('note')}
            className={`
              inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
              font-medium transition-all
              ${
    activeTab === 'note'
      ? 'bg-background text-foreground shadow-xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
            `}
          >
            <FileText className="size-3.5" />
            <span>Notas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inbox')}
            className={`
              inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
              font-medium transition-all
              ${
    activeTab === 'inbox'
      ? 'bg-background text-foreground shadow-xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
            `}
          >
            <Inbox className="size-3.5" />
            <span>Inbox</span>
          </button>
        </div>

        {/* Filtro de estado para tareas y botón refrescar */}
        <div className="flex items-center gap-2">
          {(activeTab === 'all' || activeTab === 'task') && (
            <div className="
              flex items-center gap-1 rounded-lg border bg-card p-0.5 text-xs
              font-medium text-muted-foreground
            "
            >
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`
                  rounded-md px-2.5 py-1 transition-all
                  ${
            statusFilter === 'pending'
              ? `bg-primary font-semibold text-primary-foreground shadow-2xs`
              : 'hover:text-foreground'
            }
                `}
              >
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('done')}
                className={`
                  rounded-md px-2.5 py-1 transition-all
                  ${
            statusFilter === 'done'
              ? `bg-primary font-semibold text-primary-foreground shadow-2xs`
              : 'hover:text-foreground'
            }
                `}
              >
                Completadas
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`
                  rounded-md px-2.5 py-1 transition-all
                  ${
            statusFilter === 'all'
              ? `bg-primary font-semibold text-primary-foreground shadow-2xs`
              : 'hover:text-foreground'
            }
                `}
              >
                Ver Todo
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void fetchMolecules()}
            disabled={isLoading}
            className="
              rounded-lg border bg-card p-1.5 text-muted-foreground
              transition-colors
              hover:text-foreground
              disabled:opacity-50
            "
            title="Refrescar feed"
            aria-label="Refrescar feed"
          >
            <RefreshCw className={`
              size-4
              ${isLoading ? 'animate-spin' : ''}
            `}
            />
          </button>
        </div>
      </div>

      {/* Barra de Filtro de Contexto / Grafo Biológico */}
      <ContextFilterBar
        activeFilterAtom={activeFilterAtom}
        onClearFilter={() => setActiveFilterAtom(null)}
        onSelectFilter={atomStub => setActiveFilterAtom({
          id: atomStub.id,
          organizationId: '',
          type: atomStub.type,
          payload: { name: atomStub.name },
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })}
      />

      {/* Mensaje de Error */}
      {error && (
        <div className="
          rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700
          dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300
        "
        >
          {error}
        </div>
      )}

      {/* Lista de Moléculas */}
      {isLoading && molecules.length === 0
        ? (
            <div className="
              flex flex-col items-center justify-center py-16
              text-muted-foreground
            "
            >
              <RefreshCw className="size-6 animate-spin opacity-50" />
              <p className="mt-2 text-sm">Cargando átomos...</p>
            </div>
          )
        : molecules.length === 0
          ? (
              <div className="
                flex flex-col items-center justify-center rounded-2xl border
                border-dashed bg-card/40 py-16 text-center
              "
              >
                <div className="
                  flex size-12 items-center justify-center rounded-2xl
                  bg-primary/10 text-primary
                "
                >
                  {activeTab === 'task'
                    ? (
                        <CheckCircle2 className="size-6" />
                      )
                    : (
                        <Sparkles className="size-6" />
                      )}
                </div>
                <h3 className="mt-3 text-base font-semibold text-foreground">
                  {activeTab === 'task'
                    ? statusFilter === 'done'
                      ? 'No hay tareas completadas todavía'
                      : 'No tienes tareas pendientes'
                    : 'No hay elementos en esta vista'}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Pulsa
                  {' '}
                  <kbd className="
                    rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs
                    font-medium
                  "
                  >
                    ⌘K
                  </kbd>
                  {' '}
                  o abre la Omnibarra para capturar un átomo con @entidades, //fechas y #contextos.
                </p>
                <button
                  type="button"
                  onClick={openOmnibar}
                  className="
                    mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary
                    px-3.5 py-2 text-xs font-semibold text-primary-foreground
                    shadow-xs transition-colors
                    hover:bg-primary/90
                  "
                >
                  <Plus className="size-4" />
                  <span>Capturar nuevo átomo</span>
                </button>
              </div>
            )
          : (
              <div className="flex flex-col gap-2.5">
                {molecules.map(molecule => (
                  <MoleculeCard
                    key={molecule.root.id}
                    molecule={molecule}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDelete}
                    onFilterByAtom={atom => setActiveFilterAtom(atom)}
                  />
                ))}
              </div>
            )}
    </div>
  );
};
