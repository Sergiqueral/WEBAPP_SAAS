'use client';

import type { Atom, MolecularProjection } from '@/modules/codex/domain/types';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  CornerDownRight,
  Edit2,
  FileText,
  Hash,
  Inbox,
  Link2,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { OmnibarParser } from '@/modules/codex/omnibar/parser/OmnibarParser';
import { MolecularFootprint } from '@/modules/codex/omnibar/ui/MolecularFootprint';

export type MoleculeDetailModalProps = {
  atomId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onAtomMutated?: (updatedAtom: Atom) => void;
  onAtomDeleted?: (atomId: string) => void;
};

export const MoleculeDetailModal: React.FC<MoleculeDetailModalProps> = ({
  atomId,
  isOpen,
  onAtomDeleted,
  onAtomMutated,
  onClose,
}) => {
  // Pila de navegación de saltos moleculares derivados de la navegación de vecinos
  const [subHistory, setSubHistory] = useState<string[]>([]);
  const currentAtomId = subHistory.length > 0
    ? (subHistory[subHistory.length - 1] ?? '')
    : (atomId ?? '');

  const [molecule, setMolecule] = useState<MolecularProjection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Estados de edición in-situ
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Estados de eliminación con confirmación accesible
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Estados de conexión rápida de sinapsis
  const [isAddingSynapse, setIsAddingSynapse] = useState(false);
  const [availableTargets, setAvailableTargets] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [relationType, setRelationType] = useState('ASSIGNED_TO');
  const [isConnecting, setIsConnecting] = useState(false);

  // Cargar molécula actual
  const fetchMolecule = useCallback(async (id: string, signal?: AbortSignal) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/v1/atoms/${id}`, { signal });
      if (!res.ok) {
        throw new Error('No se pudo cargar el detalle molecular');
      }
      const data = await res.json();
      setMolecule(data.molecule);
      const payload = (data.molecule?.root?.payload ?? {}) as Record<string, unknown>;
      setEditTitle(
        typeof payload.title === 'string'
          ? payload.title
          : typeof payload.content === 'string'
            ? payload.content
            : '',
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setFetchError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentAtomId || !isOpen) {
      return;
    }
    const controller = new AbortController();
    void fetchMolecule(currentAtomId, controller.signal);
    return () => {
      controller.abort();
    };
  }, [currentAtomId, isOpen, fetchMolecule]);

  // Cargar sugerencias de átomos candidatos para conectar sinapsis
  useEffect(() => {
    if (!isAddingSynapse) {
      return;
    }
    const controller = new AbortController();
    fetch('/api/v1/omnibar/suggestions', { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then((data) => {
        if (!data) {
          return;
        }
        const entities = (data.entities ?? []).map((e: { id: string; name: string }) => ({ ...e, type: 'entity' }));
        const contexts = (data.contexts ?? []).map((c: { id: string; name: string }) => ({ ...c, type: 'context' }));
        const all = [...entities, ...contexts].filter(t => t.id !== currentAtomId);
        setAvailableTargets(all);
        if (all.length > 0 && !selectedTargetId) {
          setSelectedTargetId(all[0]?.id ?? '');
        }
      })
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }, [isAddingSynapse, currentAtomId, selectedTargetId]);

  const handleClose = () => {
    setSubHistory([]);
    setIsEditing(false);
    setIsAddingSynapse(false);
    setIsConfirmingDelete(false);
    setActionError(null);
    onClose();
  };

  // Navegar (Hop) hacia un átomo vecino
  const handleNavigateTo = (targetId: string) => {
    setSubHistory(prev => [...prev, targetId]);
    setIsEditing(false);
    setIsAddingSynapse(false);
    setIsConfirmingDelete(false);
    setActionError(null);
  };

  // Volver atrás en el grafo
  const handleBack = () => {
    if (subHistory.length > 0) {
      setSubHistory(prev => prev.slice(0, -1));
      setIsEditing(false);
      setIsAddingSynapse(false);
      setIsConfirmingDelete(false);
      setActionError(null);
    }
  };

  // Mutación de estado (completado / pendiente)
  const handleToggleStatus = async () => {
    if (!molecule?.root) {
      return;
    }
    const currentPayload = (molecule.root.payload ?? {}) as Record<string, unknown>;
    const currentStatus = typeof currentPayload.status === 'string' ? currentPayload.status : 'pending';
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';

    // Optimista
    const updatedRoot: Atom = {
      ...molecule.root,
      payload: { ...currentPayload, status: nextStatus },
      updatedAt: new Date(),
    };
    setMolecule({ ...molecule, root: updatedRoot });
    onAtomMutated?.(updatedRoot);

    try {
      const res = await fetch(`/api/v1/atoms/${molecule.root.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { status: nextStatus } }),
      });
      if (!res.ok) {
        throw new Error('Fallo al actualizar estado');
      }
    } catch {
      void fetchMolecule(molecule.root.id);
    }
  };

  // Guardar edición in-situ del título y sintaxis Omnibarra
  const handleSaveTitle = async () => {
    if (!molecule?.root || !editTitle.trim()) {
      return;
    }
    setIsSaving(true);
    setActionError(null);

    const parsedTokens = OmnibarParser.extractTokens(editTitle.trim());
    const cleanTitle = parsedTokens.cleanText.trim() || editTitle.trim();

    const currentPayload = (molecule.root.payload ?? {}) as Record<string, unknown>;
    const updatedPayload = { ...currentPayload, title: cleanTitle };

    const updatedRoot: Atom = {
      ...molecule.root,
      payload: updatedPayload,
      updatedAt: new Date(),
    };
    setMolecule({ ...molecule, root: updatedRoot });
    onAtomMutated?.(updatedRoot);

    try {
      const res = await fetch(`/api/v1/atoms/${molecule.root.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: editTitle.trim() }),
      });
      if (!res.ok) {
        throw new Error('Error al guardar título');
      }
      setIsEditing(false);
      void fetchMolecule(molecule.root.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al guardar');
      void fetchMolecule(molecule.root.id);
    } finally {
      setIsSaving(false);
    }
  };

  // Quitar fecha de vencimiento
  const handleClearDueDate = async () => {
    if (!molecule?.root) {
      return;
    }
    setIsSaving(true);
    try {
      const currentPayload = { ...((molecule.root.payload ?? {}) as Record<string, unknown>) };
      delete currentPayload.dueDate;
      const currentMetadata = { ...((molecule.root.metadata ?? {}) as Record<string, unknown>) };
      delete currentMetadata.due_date;
      delete currentMetadata.has_time;
      delete currentMetadata.raw_expression;

      const res = await fetch(`/api/v1/atoms/${molecule.root.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: currentPayload,
          metadata: currentMetadata,
        }),
      });
      if (res.ok) {
        void fetchMolecule(molecule.root.id);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar átomo
  const handleConfirmDelete = async () => {
    if (!molecule?.root) {
      return;
    }
    const rootId = molecule.root.id;
    try {
      const res = await fetch(`/api/v1/atoms/${rootId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Error al eliminar átomo');
      }
      onAtomDeleted?.(rootId);
      if (subHistory.length > 0) {
        handleBack();
      } else {
        handleClose();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al eliminar');
      setIsConfirmingDelete(false);
    }
  };

  // Conectar nueva sinapsis
  const handleCreateSynapse = async () => {
    if (!currentAtomId || !selectedTargetId) {
      return;
    }
    setIsConnecting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/v1/synapses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceAtomId: currentAtomId,
          targetAtomId: selectedTargetId,
          relationType,
        }),
      });
      if (!res.ok) {
        throw new Error('Error al conectar sinapsis');
      }
      setIsAddingSynapse(false);
      void fetchMolecule(currentAtomId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al enlazar');
    } finally {
      setIsConnecting(false);
    }
  };

  // Desconectar sinapsis
  const handleDeleteSynapse = async (linkId: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/synapses/${linkId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Error al desconectar sinapsis');
      }
      if (currentAtomId) {
        void fetchMolecule(currentAtomId);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al desconectar');
    }
  };

  const root = molecule?.root;
  const payload = (root?.payload ?? {}) as Record<string, unknown>;
  const isTask = root?.type === 'task';
  const status = typeof payload.status === 'string' ? payload.status : 'pending';
  const isDone = status === 'done';
  const title = typeof payload.title === 'string'
    ? payload.title
    : typeof payload.content === 'string'
      ? payload.content
      : typeof payload.name === 'string'
        ? payload.name
        : 'Sin título';

  const provenance = typeof root?.metadata?.provenance === 'string' ? root.metadata.provenance : 'manual';

  const dueDateStr = typeof payload.dueDate === 'string'
    ? payload.dueDate
    : typeof root?.metadata?.due_date === 'string'
      ? root.metadata.due_date
      : null;

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
      label = due.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    }

    return { label, isOverdue, isToday };
  }, [dueDateStr, isDone]);

  const liveTokens = React.useMemo(() => {
    if (!isEditing || !editTitle.trim()) {
      return null;
    }
    return OmnibarParser.extractTokens(editTitle);
  }, [isEditing, editTitle]);
  const hasLiveTokens = Boolean(
    liveTokens && (liveTokens.temporal || liveTokens.entities.length > 0 || liveTokens.contexts.length > 0),
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="
          fixed inset-0 z-50 bg-black/60 backdrop-blur-xs
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0
          data-[state=open]:animate-in data-[state=open]:fade-in-0
        "
        />
        <Dialog.Content
          aria-describedby="molecule-detail-description"
          className="
            fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-2xl
            -translate-1/2 overflow-y-auto rounded-2xl border border-border
            bg-card p-6 shadow-2xl transition-all
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=closed]:zoom-out-95
            data-[state=open]:animate-in data-[state=open]:fade-in-0
            data-[state=open]:zoom-in-95
          "
        >
          {/* Barra de Navegación del Grafo y Botón Cerrar */}
          <div className="
            mb-4 flex items-center justify-between border-b border-border pb-3
          "
          >
            <div className="flex items-center gap-2">
              {subHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="
                    flex items-center gap-1 rounded-md border border-border
                    bg-secondary px-2.5 py-1 text-xs font-medium
                    text-secondary-foreground transition-all
                    hover:bg-accent
                  "
                >
                  <ArrowLeft className="size-3.5" />
                  Volver atrás
                </button>
              )}
              <span className="text-xs text-muted-foreground">
                Profundidad del grafo: nivel
                {' '}
                {subHistory.length + 1}
              </span>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="
                  rounded-full p-1.5 text-muted-foreground transition-colors
                  hover:bg-accent hover:text-foreground
                "
                aria-label="Cerrar modal"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <p id="molecule-detail-description" className="sr-only">
            Detalle molecular del átomo inspeccionado, relaciones químicas y provenance.
          </p>

          {/* Banner de error de acción puntual */}
          {actionError && (
            <div className="
              mb-4 flex items-center justify-between rounded-xl border
              border-destructive/30 bg-destructive/10 p-3 text-xs
              text-destructive
            "
            >
              <div className="flex items-center gap-1.5">
                <AlertCircle className="size-4" />
                <span>{actionError}</span>
              </div>
              <button type="button" onClick={() => setActionError(null)}>
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {isLoading
            ? (
                <div className="
                  flex flex-col items-center justify-center py-12
                  text-muted-foreground
                "
                >
                  <Loader2 className="mb-2 size-8 animate-spin text-primary" />
                  <p className="text-sm">Cargando proyección molecular...</p>
                </div>
              )
            : fetchError
              ? (
                  <div className="
                    rounded-xl border border-destructive/30 bg-destructive/10
                    p-4 text-sm text-destructive
                  "
                  >
                    {fetchError}
                  </div>
                )
              : root
                ? (
                    <div className="space-y-6">
                      {/* Cabecera Atómica */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-1 items-start gap-3">
                          {/* Checkbox para tareas o Icono tipado */}
                          <div className="pt-1">
                            {isTask
                              ? (
                                  <button
                                    type="button"
                                    onClick={handleToggleStatus}
                                    className={`
                                      flex size-6 items-center justify-center
                                      rounded-md border transition-all
                                      ${
                                  isDone
                                    ? `
                                      border-emerald-600 bg-emerald-600
                                      text-white
                                    `
                                    : `
                                      border-muted-foreground/40
                                      hover:border-primary hover:bg-primary/10
                                    `
                                  }
                                    `}
                                    aria-label={isDone ? 'Marcar pendiente' : 'Marcar completada'}
                                  >
                                    {isDone && (
                                      <Check className="size-4 stroke-3" />
                                    )}
                                  </button>
                                )
                              : root.type === 'client' || root.type === 'contact'
                                ? (
                                    <div className="
                                      flex size-6 items-center justify-center
                                      rounded-md bg-purple-500/10
                                      text-purple-600
                                    "
                                    >
                                      <User className="size-4" />
                                    </div>
                                  )
                                : root.type === 'project' || root.type === 'tag'
                                  ? (
                                      <div className="
                                        flex size-6 items-center justify-center
                                        rounded-md bg-sky-500/10 text-sky-600
                                      "
                                      >
                                        <Hash className="size-4" />
                                      </div>
                                    )
                                  : root.type === 'note'
                                    ? (
                                        <div className="
                                          flex size-6 items-center
                                          justify-center rounded-md
                                          bg-amber-500/10 text-amber-600
                                        "
                                        >
                                          <FileText className="size-4" />
                                        </div>
                                      )
                                    : (
                                        <div className="
                                          flex size-6 items-center
                                          justify-center rounded-md bg-muted
                                          text-muted-foreground
                                        "
                                        >
                                          <Inbox className="size-4" />
                                        </div>
                                      )}
                          </div>

                          {/* Título editable */}
                          <div className="flex-1">
                            {isEditing
                              ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void handleSaveTitle();
                                          } else if (e.key === 'Escape') {
                                            setIsEditing(false);
                                          }
                                        }}
                                        placeholder="Título... usa @ // #"
                                        className="
                                          flex-1 rounded-lg border
                                          border-primary bg-background px-3
                                          py-1.5 text-base font-semibold
                                          text-foreground
                                          focus:outline-hidden
                                        "
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={handleSaveTitle}
                                        className="
                                          rounded-lg bg-primary px-3 py-1.5
                                          text-xs font-medium
                                          text-primary-foreground
                                        "
                                      >
                                        {isSaving ? 'Guardando...' : 'Guardar'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="
                                          rounded-lg border px-3 py-1.5 text-xs
                                          font-medium text-muted-foreground
                                        "
                                      >
                                        Cancelar
                                      </button>
                                    </div>

                                    {hasLiveTokens && liveTokens && (
                                      <div className="
                                        rounded-xl border border-primary/20
                                        bg-primary/5 p-2 text-xs
                                      "
                                      >
                                        <div className="
                                          mb-1 text-[10px] font-semibold
                                          tracking-wider text-muted-foreground
                                          uppercase
                                        "
                                        >
                                          Sintaxis detectada (se aplicará al guardar)
                                        </div>
                                        <MolecularFootprint tokens={liveTokens} />
                                      </div>
                                    )}
                                  </div>
                                )
                              : (
                                  <div className="flex items-center gap-2">
                                    <Dialog.Title
                                      className={`
                                        text-xl font-bold text-foreground
                                        ${isDone
                                    ? `text-muted-foreground line-through`
                                    : ''}
                                      `}
                                    >
                                      {title}
                                    </Dialog.Title>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditTitle(title);
                                        setIsEditing(true);
                                      }}
                                      className="
                                        text-muted-foreground transition-colors
                                        hover:text-foreground
                                      "
                                      title="Editar título (soporta @ // #)"
                                    >
                                      <Edit2 className="size-3.5" />
                                    </button>
                                  </div>
                                )}

                            <div className="
                              mt-1 flex flex-wrap items-center gap-2
                            "
                            >
                              <span className="
                                rounded-md bg-secondary px-2 py-0.5 text-xs
                                font-semibold text-secondary-foreground
                                uppercase
                              "
                              >
                                {root.type}
                              </span>

                              {dueDateStr && (
                                <span className={`
                                  flex items-center gap-1.5 rounded-md px-2
                                  py-0.5 text-xs font-semibold
                                  ${isDone
                                  ? 'bg-muted text-muted-foreground'
                                  : dueInfo?.isOverdue
                                    ? `
                                      border border-destructive/20
                                      bg-destructive/10 text-destructive
                                    `
                                    : `
                                      border border-emerald-500/20
                                      bg-emerald-500/10 text-emerald-700
                                      dark:text-emerald-400
                                    `
                                }
                                `}
                                >
                                  <Calendar className="size-3" />
                                  <span>{dueInfo?.label ?? dueDateStr}</span>
                                  <button
                                    type="button"
                                    onClick={handleClearDueDate}
                                    className="
                                      ml-1 opacity-60
                                      hover:text-destructive hover:opacity-100
                                    "
                                    title="Quitar fecha"
                                  >
                                    <X className="size-2.5" />
                                  </button>
                                </span>
                              )}

                              <span className="
                                flex items-center gap-1 text-xs
                                text-muted-foreground
                              "
                              >
                                <Clock className="size-3" />
                                ID:
                                {' '}
                                {root.id.slice(0, 12)}
                                ...
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botón de eliminación con confirmación accesible */}
                        {isConfirmingDelete
                          ? (
                              <div className="
                                flex items-center gap-1.5 rounded-lg border
                                border-destructive/30 bg-destructive/10 p-1.5
                              "
                              >
                                <span className="
                                  text-xs font-semibold text-destructive
                                "
                                >
                                  ¿Eliminar?
                                </span>
                                <button
                                  type="button"
                                  onClick={handleConfirmDelete}
                                  className="
                                    rounded-sm bg-destructive px-2 py-1 text-xs
                                    font-semibold text-white
                                    hover:bg-destructive/90
                                  "
                                >
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsConfirmingDelete(false)}
                                  className="
                                    rounded-sm border border-border px-2 py-1
                                    text-xs font-medium text-muted-foreground
                                    hover:bg-accent
                                  "
                                >
                                  No
                                </button>
                              </div>
                            )
                          : (
                              <button
                                type="button"
                                onClick={() => setIsConfirmingDelete(true)}
                                className="
                                  rounded-lg border border-destructive/20 p-2
                                  text-destructive transition-colors
                                  hover:bg-destructive/10
                                "
                                title="Eliminar este átomo"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                      </div>

                      {/* SECCIÓN 1: Sinapsis Salientes (Outgoing) */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="
                            flex items-center gap-1.5 text-sm font-semibold
                            text-foreground
                          "
                          >
                            <Link2 className="size-4 text-primary" />
                            Sinapsis Salientes (Hacia dónde apunta)
                          </h4>

                          <button
                            type="button"
                            onClick={() => setIsAddingSynapse(!isAddingSynapse)}
                            className="
                              flex items-center gap-1 rounded-md border
                              border-dashed border-primary/50 px-2 py-1 text-xs
                              font-medium text-primary transition-colors
                              hover:bg-primary/10
                            "
                          >
                            <Plus className="size-3" />
                            {isAddingSynapse ? 'Cancelar' : 'Enlazar átomo'}
                          </button>
                        </div>

                        {/* Formulario para agregar sinapsis */}
                        {isAddingSynapse && (
                          <div className="
                            rounded-xl border border-primary/30 bg-primary/5 p-3
                          "
                          >
                            <p className="
                              mb-2 text-xs font-medium text-muted-foreground
                            "
                            >
                              Conectar químicamente con otra partícula:
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={relationType}
                                onChange={e => setRelationType(e.target.value)}
                                className="
                                  rounded-lg border border-border bg-background
                                  px-2.5 py-1.5 text-xs font-medium
                                "
                              >
                                <option value="ASSIGNED_TO">ASSIGNED_TO</option>
                                <option value="TAGGED_WITH">TAGGED_WITH</option>
                                <option value="DEPENDS_ON">DEPENDS_ON</option>
                                <option value="RELATED_TO">RELATED_TO</option>
                              </select>

                              <select
                                value={selectedTargetId}
                                onChange={e => setSelectedTargetId(e.target.value)}
                                className="
                                  flex-1 rounded-lg border border-border
                                  bg-background px-2.5 py-1.5 text-xs
                                  font-medium
                                "
                              >
                                {availableTargets.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                    {' '}
                                    (
                                    {t.type}
                                    )
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                disabled={isConnecting || !selectedTargetId}
                                onClick={handleCreateSynapse}
                                className="
                                  rounded-lg bg-primary px-3 py-1.5 text-xs
                                  font-semibold text-primary-foreground
                                  hover:bg-primary/90
                                "
                              >
                                {isConnecting ? 'Enlazando...' : 'Crear Enlace'}
                              </button>
                            </div>
                          </div>
                        )}

                        {molecule?.outgoing.length === 0
                          ? (
                              <p className="
                                text-xs text-muted-foreground italic
                              "
                              >
                                Este átomo no tiene conexiones salientes activas.
                              </p>
                            )
                          : (
                              <div className="
                                grid grid-cols-1 gap-2
                                sm:grid-cols-2
                              "
                              >
                                {molecule?.outgoing.map((syn) => {
                                  const targetPayload = (syn.atom.payload ?? {}) as Record<string, unknown>;
                                  const targetName = typeof targetPayload.name === 'string'
                                    ? targetPayload.name
                                    : typeof targetPayload.title === 'string'
                                      ? targetPayload.title
                                      : syn.atom.id;

                                  return (
                                    <div
                                      key={syn.linkId}
                                      className="
                                        group flex items-center justify-between
                                        rounded-xl border border-border bg-card
                                        p-2.5 text-xs transition-all
                                        hover:border-primary/50
                                      "
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleNavigateTo(syn.atom.id)}
                                        className="
                                          flex min-w-0 flex-1 items-center gap-2
                                          text-left
                                        "
                                      >
                                        <span className="
                                          rounded-sm bg-muted px-1.5 py-0.5
                                          font-mono text-[10px]
                                          text-muted-foreground
                                        "
                                        >
                                          {syn.relationType}
                                        </span>
                                        <span className="
                                          truncate font-semibold text-foreground
                                          transition-colors
                                          group-hover:text-primary
                                        "
                                        >
                                          {targetName}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSynapse(syn.linkId)}
                                        className="
                                          ml-2 text-muted-foreground/60
                                          transition-colors
                                          hover:text-destructive
                                        "
                                        title="Desconectar sinapsis"
                                      >
                                        <X className="size-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                      </div>

                      {/* SECCIÓN 2: Sinapsis Entrantes (Incoming) */}
                      <div className="space-y-3">
                        <h4 className="
                          flex items-center gap-1.5 text-sm font-semibold
                          text-foreground
                        "
                        >
                          <CornerDownRight className="size-4 text-emerald-600" />
                          Sinapsis Entrantes (Átomos que apuntan a éste)
                        </h4>

                        {molecule?.incoming.length === 0
                          ? (
                              <p className="
                                text-xs text-muted-foreground italic
                              "
                              >
                                Ningún átomo externo apunta a esta partícula actualmente.
                              </p>
                            )
                          : (
                              <div className="
                                grid grid-cols-1 gap-2
                                sm:grid-cols-2
                              "
                              >
                                {molecule?.incoming.map((syn) => {
                                  const sourcePayload = (syn.atom.payload ?? {}) as Record<string, unknown>;
                                  const sourceName = typeof sourcePayload.title === 'string'
                                    ? sourcePayload.title
                                    : typeof sourcePayload.name === 'string'
                                      ? sourcePayload.name
                                      : syn.atom.id;

                                  return (
                                    <div
                                      key={syn.linkId}
                                      className="
                                        group flex items-center justify-between
                                        rounded-xl border border-border bg-card
                                        p-2.5 text-xs transition-all
                                        hover:border-emerald-500/50
                                      "
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleNavigateTo(syn.atom.id)}
                                        className="
                                          flex min-w-0 flex-1 items-center gap-2
                                          text-left
                                        "
                                      >
                                        <span className="
                                          rounded-sm bg-emerald-500/10 px-1.5
                                          py-0.5 font-mono text-[10px]
                                          text-emerald-700
                                          dark:text-emerald-400
                                        "
                                        >
                                          {syn.relationType}
                                        </span>
                                        <span className="
                                          truncate font-semibold text-foreground
                                          transition-colors
                                          group-hover:text-emerald-600
                                        "
                                        >
                                          {sourceName}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSynapse(syn.linkId)}
                                        className="
                                          ml-2 text-muted-foreground/60
                                          transition-colors
                                          hover:text-destructive
                                        "
                                        title="Desconectar sinapsis"
                                      >
                                        <X className="size-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                      </div>

                      {/* SECCIÓN 3: Auditoría y Provenance */}
                      <div className="
                        rounded-xl border border-border bg-muted/30 p-3 text-xs
                      "
                      >
                        <div className="
                          mb-2 flex items-center gap-1.5 font-semibold
                          text-foreground
                        "
                        >
                          <ShieldCheck className="size-4 text-primary" />
                          Auditoría Biológica y Provenance
                        </div>
                        <div className="
                          grid grid-cols-2 gap-2 text-muted-foreground
                        "
                        >
                          <div>
                            <span className="font-medium text-foreground">
                              Origen:
                            </span>
                            {' '}
                            <span className="
                              rounded-sm bg-secondary px-1.5 py-0.5 font-mono
                              text-[11px]
                            "
                            >
                              {provenance}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-foreground">
                              Creado:
                            </span>
                            {' '}
                            {new Date(root.createdAt).toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">
                              Organización:
                            </span>
                            {' '}
                            {root.organizationId.slice(0, 10)}
                            ...
                          </div>
                          <div>
                            <span className="font-medium text-foreground">
                              Actualizado:
                            </span>
                            {' '}
                            {new Date(root.updatedAt).toLocaleString()}
                          </div>
                        </div>

                        {molecule?.externalIdentities && molecule.externalIdentities.length > 0 && (
                          <div className="
                            mt-2 border-t border-border pt-2 text-[11px]
                          "
                          >
                            <span className="font-medium text-foreground">
                              Identidades Satélite:
                            </span>
                            {' '}
                            {molecule.externalIdentities.map(ext => (
                              <span
                                key={ext.id}
                                className="
                                  mr-1.5 inline-flex items-center gap-1
                                  rounded-sm bg-primary/10 px-1.5 py-0.5
                                  text-primary
                                "
                              >
                                <Calendar className="size-3" />
                                {ext.provider}
                                :
                                {' '}
                                {ext.externalId}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
