'use client';

import type { CellMetrics } from '../../domain/cell/cellMetrics';
import type { Atom } from '../../domain/types';
import {
  CheckCircle2,
  Clock,
  Dna,
  FolderKanban,
  Plus,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import React from 'react';

export type CellHeaderProps = {
  cellAtom: Atom;
  metrics: CellMetrics;
  statusFilter: 'all' | 'done' | 'pending';
  onStatusFilterChange: (status: 'all' | 'done' | 'pending') => void;
  onClearCell: () => void;
  onQuickCapture?: (contextName: string) => void;
  onSelectCollaborator?: (atom: Atom) => void;
  onOpenEntityLens?: (atom: Atom) => void;
};

/**
 * CellHeader (Ficha / Membrana de Célula Biológica)
 *
 * Encapsula la vista de un Contexto (#) o Proyecto, proyectando la salud
 * de su metabolismo: progreso biológico, partículas completadas vs pendientes,
 * desglose y colaboradores vinculados mediante sinapsis.
 */
export const CellHeader: React.FC<CellHeaderProps> = ({
  cellAtom,
  metrics,
  onClearCell,
  onOpenEntityLens,
  onQuickCapture,
  onSelectCollaborator,
  onStatusFilterChange,
  statusFilter,
}) => {
  const payload = (cellAtom.payload ?? {}) as Record<string, unknown>;
  const cellName = String(payload.name ?? payload.title ?? cellAtom.id);
  const isContext = cellAtom.type === 'context';
  const isEntity = ['entity', 'client', 'contact', 'person', 'provider', 'employee'].includes(cellAtom.type);

  const handleCapture = () => {
    if (onQuickCapture) {
      onQuickCapture(cellName);
      return;
    }
    // Dispara el evento global para abrir la Omnibarra
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      }),
    );
  };

  const getProgressColor = () => {
    if (metrics.total === 0) {
      return 'bg-muted-foreground/30';
    }
    if (metrics.completionPercentage === 100) {
      return 'bg-emerald-500';
    }
    if (metrics.completionPercentage >= 50) {
      return 'bg-primary';
    }
    return 'bg-amber-500';
  };

  return (
    <section
      aria-label={`Ficha de la célula ${cellName}`}
      className={`
        relative overflow-hidden rounded-2xl border p-4 shadow-xs transition-all
        sm:p-5
        ${
    isContext
      ? `
        border-emerald-500/30 bg-linear-to-br from-emerald-500/5 via-transparent
        to-emerald-500/10
      `
      : isEntity
        ? `
          border-purple-500/30 bg-linear-to-br from-purple-500/5 via-transparent
          to-purple-500/10
        `
        : `
          border-primary/30 bg-linear-to-br from-primary/5 via-transparent
          to-primary/10
        `
    }
      `}
    >
      {/* Cabecera superior: Identidad de la Célula y Botón Salir */}
      <div className="
        flex flex-col gap-3
        sm:flex-row sm:items-start sm:justify-between
      "
      >
        <div className="flex items-start gap-3">
          <div
            className={`
              flex size-11 shrink-0 items-center justify-center rounded-xl
              border shadow-2xs
              ${
    isContext
      ? `
        border-emerald-500/30 bg-emerald-500/10 text-emerald-600
        dark:text-emerald-400
      `
      : isEntity
        ? `
          border-purple-500/30 bg-purple-500/10 text-purple-600
          dark:text-purple-400
        `
        : 'border-primary/30 bg-primary/10 text-primary'
    }
            `}
          >
            {isContext
              ? (
                  <FolderKanban className="size-5.5" />
                )
              : isEntity
                ? (
                    <User className="size-5.5" />
                  )
                : (
                    <Dna className="size-5.5" />
                  )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="
                text-[11px] font-semibold tracking-wider text-muted-foreground
                uppercase
              "
              >
                {isContext ? 'Célula de Contexto' : isEntity ? 'Célula de Entidad' : 'Célula Biológica'}
              </span>
              <span
                className={`
                  rounded-full px-2 py-0.5 text-[10px] font-medium
                  ${
    metrics.completionPercentage === 100 && metrics.total > 0
      ? `
        bg-emerald-500/15 text-emerald-700
        dark:text-emerald-300
      `
      : metrics.total === 0
        ? 'bg-muted text-muted-foreground'
        : 'bg-primary/15 text-primary'
    }
                `}
              >
                {metrics.completionPercentage === 100 && metrics.total > 0
                  ? 'Completada'
                  : metrics.total === 0
                    ? 'Vacía'
                    : 'Activa'}
              </span>
            </div>

            <h2 className="
              mt-0.5 text-lg font-bold tracking-tight text-foreground
              sm:text-xl
            "
            >
              {isContext ? `#${cellName}` : isEntity ? `@${cellName}` : cellName}
            </h2>
          </div>
        </div>

        {/* Acciones principales de la Célula */}
        <div className="
          flex items-center gap-2 self-end
          sm:self-auto
        "
        >
          {isEntity && onOpenEntityLens && (
            <button
              type="button"
              onClick={() => onOpenEntityLens(cellAtom)}
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
            onClick={handleCapture}
            className="
              inline-flex items-center gap-1.5 rounded-lg border
              border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium
              text-primary transition-colors
              hover:bg-primary hover:text-primary-foreground
            "
          >
            <Plus className="size-3.5" />
            <span>
              Capturar en
              {isContext ? `#${cellName}` : `@${cellName}`}
            </span>
          </button>

          <button
            type="button"
            onClick={onClearCell}
            aria-label="Salir de la célula y ver todo el feed"
            className="
              inline-flex items-center gap-1 rounded-lg border border-border/60
              bg-background/80 px-2.5 py-1 text-xs font-medium
              text-muted-foreground transition-colors
              hover:bg-accent hover:text-foreground
            "
          >
            <X className="size-3.5" />
            <span className="
              hidden
              sm:inline
            "
            >
              Salir
            </span>
          </button>
        </div>
      </div>

      {/* Barra de Progreso Biológico */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="
            flex items-center gap-1.5 font-medium text-muted-foreground
          "
          >
            <Sparkles className="size-3.5 text-primary" />
            Progreso metabólico
          </span>
          <span className="font-semibold text-foreground">
            {metrics.completionPercentage}
            % completado
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={metrics.completionPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso de la célula ${cellName}`}
          className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60"
        >
          <div
            className={`
              h-full rounded-full transition-all duration-500 ease-out
              ${getProgressColor()}
            `}
            style={{ width: `${Math.max(metrics.completionPercentage, 2)}%` }}
          />
        </div>

        <div className="
          flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]
          text-muted-foreground
        "
        >
          <div className="flex items-center gap-3">
            <span className="
              flex items-center gap-1 text-amber-600
              dark:text-amber-400
            "
            >
              <Clock className="size-3" />
              <strong>{metrics.pending}</strong>
              {' '}
              pendientes
            </span>
            <span className="
              flex items-center gap-1 text-emerald-600
              dark:text-emerald-400
            "
            >
              <CheckCircle2 className="size-3" />
              <strong>{metrics.completed}</strong>
              {' '}
              completadas
            </span>
            <span>
              Total:
              {' '}
              <strong>{metrics.total}</strong>
              {' '}
              partículas
            </span>
          </div>

          {/* Selector de estado integrado en la célula */}
          <div className="
            flex items-center rounded-lg border bg-background/60 p-0.5
            shadow-2xs
          "
          >
            <button
              type="button"
              onClick={() => onStatusFilterChange('pending')}
              className={`
                rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors
                ${
    statusFilter === 'pending'
      ? 'bg-primary text-primary-foreground shadow-2xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              Pendientes (
              {metrics.pending}
              )
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange('all')}
              className={`
                rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors
                ${
    statusFilter === 'all'
      ? 'bg-primary text-primary-foreground shadow-2xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              Todas (
              {metrics.total}
              )
            </button>
            <button
              type="button"
              onClick={() => onStatusFilterChange('done')}
              className={`
                rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors
                ${
    statusFilter === 'done'
      ? 'bg-primary text-primary-foreground shadow-2xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              Hechas (
              {metrics.completed}
              )
            </button>
          </div>
        </div>
      </div>

      {/* Colaboradores Vinculados (Entidades en la Célula) */}
      {metrics.collaborators.length > 0 && (
        <div className="
          mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-border/40
          pt-2.5 text-xs
        "
        >
          <span className="text-[11px] font-medium text-muted-foreground">
            Colaboradores:
          </span>
          {metrics.collaborators.map((collaborator) => {
            const cPayload = (collaborator.payload ?? {}) as Record<string, unknown>;
            const cName = String(cPayload.name ?? collaborator.id);
            return (
              <button
                key={collaborator.id}
                type="button"
                onClick={() => onSelectCollaborator?.(collaborator)}
                title={`Ver partículas de @${cName}`}
                className="
                  inline-flex items-center gap-1 rounded-full border
                  border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[11px]
                  font-medium text-purple-700 transition-colors
                  hover:bg-purple-500/20
                  dark:text-purple-300
                "
              >
                <User className="size-3" />
                <span>
                  @
                  {cName}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
