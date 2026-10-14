'use client';

import type { Atom, MolecularProjection } from '@/modules/codex/domain/types';
import * as Dialog from '@radix-ui/react-dialog';
import {
  AlertCircle,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Filter,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Network,
  Phone,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  aggregateEntityIdentity,
} from '@/modules/codex/domain/services/viewHelpers';

export type EntityLensProps = {
  atomId?: string | null;
  phone?: string | null;
  email?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenAtomDetail?: (atomId: string) => void;
  onAtomMutated?: (updatedAtom: Atom) => void;
  onFilterByEntity?: (atom: Atom) => void;
};

type LensTab = 'summary' | 'tasks' | 'documents' | 'notes' | 'events' | 'synapses';

export const EntityLens: React.FC<EntityLensProps> = ({
  atomId,
  email,
  isOpen,
  onAtomMutated,
  onClose,
  onFilterByEntity,
  onOpenAtomDetail,
  phone,
}) => {
  const [rootAtom, setRootAtom] = useState<Atom | null>(null);
  const [rootMolecule, setRootMolecule] = useState<MolecularProjection | null>(null);
  const [connectedMolecules, setConnectedMolecules] = useState<MolecularProjection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<LensTab>('summary');
  const [copied, setCopied] = useState(false);

  // Inyector omnibarra contextual en el pie de la lente
  const [omniInput, setOmniInput] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectSuccess, setInjectSuccess] = useState(false);

  // Carga reactiva de los átomos dispersos vinculados a esta entidad
  const loadEntityData = useCallback(async (signal?: AbortSignal) => {
    if (!atomId) {
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // 1. Obtener molécula raíz (datos del átomo de entidad y sus sinapsis directas)
      const atomRes = await fetch(`/api/v1/atoms/${atomId}`, { signal });
      if (!atomRes.ok) {
        throw new Error('No se pudo cargar la información de la entidad');
      }
      const atomData = await atomRes.json();
      const mol: MolecularProjection = atomData.molecule;
      setRootMolecule(mol);
      setRootAtom(mol.root);

      // 2. Obtener todas las moléculas que enlazan con este átomo raíz (grafo disperso)
      const params = new URLSearchParams();
      params.set('targetAtomId', atomId);
      params.set('type', 'all');
      params.set('status', 'all');
      params.set('limit', '100');

      const molRes = await fetch(`/api/v1/molecules?${params.toString()}`, { signal });
      if (molRes.ok) {
        const molData = await molRes.json();
        setConnectedMolecules(molData.molecules ?? []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Error al consultar el grafo molecular');
    } finally {
      setIsLoading(false);
    }
  }, [atomId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const controller = new AbortController();
    void loadEntityData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [isOpen, loadEntityData]);

  // Agregación de Biología del Dato en tiempo real
  const aggregated = useMemo(() => {
    const res = aggregateEntityIdentity(rootAtom, connectedMolecules, rootMolecule);
    // Enriquecer con teléfonos o emails pasados por props si no estaban
    if (phone && !res.phones.includes(phone)) {
      res.phones.push(phone);
    }
    if (email && !res.emails.includes(email.toLowerCase())) {
      res.emails.push(email.toLowerCase());
    }
    return res;
  }, [rootAtom, connectedMolecules, rootMolecule, phone, email]);

  // Alternar estado de una tarea conectada directamente desde la lente
  const handleToggleTaskStatus = async (taskAtomId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';

    // Actualización optimista local
    setConnectedMolecules(prev =>
      prev.map(m =>
        m.root.id === taskAtomId
          ? {
              ...m,
              root: {
                ...m.root,
                payload: {
                  ...((m.root.payload ?? {}) as Record<string, unknown>),
                  status: nextStatus,
                },
              },
            }
          : m,
      ),
    );

    try {
      const res = await fetch(`/api/v1/atoms/${taskAtomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: { status: nextStatus },
        }),
      });

      if (!res.ok) {
        throw new Error('Fallo al actualizar estado de la tarea');
      }

      const data = await res.json();
      if (data.atom && onAtomMutated) {
        onAtomMutated(data.atom);
      }
    } catch {
      // Revertir optimismo
      void loadEntityData();
    }
  };

  // Inyección rápida de nuevo átomo contextualmente vinculado a esta entidad
  const handleInjectQuickAtom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!omniInput.trim() || !rootAtom) {
      return;
    }

    setIsInjecting(true);
    try {
      const entityTag = `@${aggregated.primaryName.replace(/\s+/g, '')}`;
      const payloadText = `${omniInput.trim()} ${entityTag}`;

      const res = await fetch('/api/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: payloadText,
          source: 'omnibar_regex',
        }),
      });

      if (!res.ok) {
        throw new Error('Error al inyectar átomo en la lente');
      }

      const data = await res.json();

      // Si se generó la molécula pero no tiene la sinapsis explícita, asegurar sinapsis bidireccional
      if (data.molecule?.root?.id && rootAtom.id) {
        try {
          await fetch('/api/v1/synapses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceAtomId: data.molecule.root.id,
              targetAtomId: rootAtom.id,
              relationType: 'ASSIGNED_TO',
            }),
          });
        } catch {
          // Si ya existía por auto-vinculación en el reactor, se ignora
        }
      }

      setOmniInput('');
      setInjectSuccess(true);
      setTimeout(setInjectSuccess, 2000, false);
      void loadEntityData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sintetizar el átomo');
    } finally {
      setIsInjecting(false);
    }
  };

  // Copiar resumen de la ficha al portapapeles
  const handleCopySummary = () => {
    const lines = [
      `FICHA DE CLIENTE / ENTIDAD: ${aggregated.primaryName}`,
      aggregated.phones.length > 0 ? `Teléfonos: ${aggregated.phones.join(', ')}` : '',
      aggregated.emails.length > 0 ? `Emails: ${aggregated.emails.join(', ')}` : '',
      aggregated.documents.length > 0 ? `Documentos: ${aggregated.documents.map(d => `${d.type}: ${d.documentNumber}`).join(', ')}` : '',
      aggregated.locations.length > 0 ? `Ubicación: ${aggregated.locations.map(l => l.normalized).join(' | ')}` : '',
      `Tareas pendientes: ${aggregated.tasks.filter(t => (t.root.payload as { status?: string })?.status !== 'done').length}`,
    ].filter(Boolean);

    void navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(setCopied, 2000, false);
  };

  const isCompany = aggregated.documents.some(d => d.type === 'CIF') || (rootAtom?.payload as { isCompany?: boolean })?.isCompany;

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="
          fixed inset-0 z-50 bg-background/80 backdrop-blur-xs
          transition-opacity
        "
        />
        <Dialog.Content className="
          fixed top-[50%] left-[50%] z-50 flex max-h-[92vh] w-[95vw] max-w-4xl
          translate-[-50%] flex-col overflow-hidden rounded-2xl border
          border-border bg-card shadow-2xl transition-all
        "
        >
          {/* CABECERA DE IDENTIDAD SINTÉTICA (Biología del Dato) */}
          <div className="
            border-b border-border bg-muted/30 px-6 py-5 backdrop-blur-xs
          "
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="
                  flex size-14 shrink-0 items-center justify-center rounded-2xl
                  border border-primary/20 bg-primary/10 text-primary shadow-xs
                "
                >
                  {isCompany
                    ? <Building className="size-7" />
                    : (
                        <User className="size-7" />
                      )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Dialog.Title className="
                      text-xl font-bold tracking-tight text-foreground
                    "
                    >
                      {aggregated.primaryName}
                    </Dialog.Title>
                    <span className="
                      inline-flex items-center gap-1 rounded-full border
                      border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs
                      font-semibold text-primary
                    "
                    >
                      <Sparkles className="size-3" />
                      Lente Molecular
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Ficha reactiva sintetizada a partir del grafo de átomos y sinapsis dispersas.
                  </p>
                </div>
              </div>

              {/* Botones de acción directa */}
              <div className="flex items-center gap-2">
                {aggregated.phones.length > 0 && (
                  <a
                    href={`tel:${aggregated.phones[0]}`}
                    className="
                      inline-flex items-center gap-1.5 rounded-xl border
                      border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5
                      text-xs font-semibold text-emerald-600 shadow-2xs
                      transition-colors
                      hover:bg-emerald-500/20
                      dark:text-emerald-400
                    "
                    title={`Llamar a ${aggregated.phones[0]}`}
                  >
                    <Phone className="size-3.5" />
                    <span className="
                      hidden
                      sm:inline
                    "
                    >
                      Llamar
                    </span>
                  </a>
                )}

                {aggregated.emails.length > 0 && (
                  <a
                    href={`mailto:${aggregated.emails[0]}`}
                    className="
                      inline-flex items-center gap-1.5 rounded-xl border
                      border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs
                      font-semibold text-sky-600 shadow-2xs transition-colors
                      hover:bg-sky-500/20
                      dark:text-sky-400
                    "
                    title={`Enviar correo a ${aggregated.emails[0]}`}
                  >
                    <Mail className="size-3.5" />
                    <span className="
                      hidden
                      sm:inline
                    "
                    >
                      Email
                    </span>
                  </a>
                )}

                {rootAtom && onFilterByEntity && (
                  <button
                    type="button"
                    onClick={() => {
                      onFilterByEntity(rootAtom);
                      onClose();
                    }}
                    className="
                      inline-flex items-center gap-1.5 rounded-xl border
                      border-border bg-background px-3 py-1.5 text-xs
                      font-medium text-foreground shadow-2xs transition-colors
                      hover:bg-accent
                    "
                    title="Filtrar feed por esta entidad"
                  >
                    <Filter className="size-3.5" />
                    <span className="
                      hidden
                      sm:inline
                    "
                    >
                      Filtrar Grafo
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="
                    inline-flex items-center gap-1.5 rounded-xl border
                    border-border bg-background p-2 text-xs font-medium
                    text-muted-foreground shadow-2xs transition-colors
                    hover:bg-accent hover:text-foreground
                  "
                  title="Copiar ficha de cliente"
                >
                  {copied
                    ? <Check className="size-4 text-emerald-500" />
                    : (
                        <Copy className="size-4" />
                      )}
                </button>

                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="
                      rounded-xl border border-transparent p-2
                      text-muted-foreground transition-colors
                      hover:bg-accent hover:text-foreground
                    "
                    title="Cerrar lente"
                  >
                    <X className="size-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {/* CINTA DE ANCLAJES MOLECULARES (Hard Anchors & Ubicación) */}
            <div className="
              mt-4 flex flex-wrap items-center gap-2 border-t border-border/50
              pt-3 text-xs
            "
            >
              {/* Teléfonos */}
              {aggregated.phones.map(phoneNum => (
                <a
                  key={phoneNum}
                  href={`tel:${phoneNum}`}
                  className="
                    inline-flex items-center gap-1.5 rounded-lg border
                    border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 font-mono
                    font-medium text-emerald-600 transition-colors
                    hover:bg-emerald-500/15
                    dark:text-emerald-400
                  "
                >
                  <Phone className="size-3" />
                  <span>{phoneNum}</span>
                </a>
              ))}

              {/* Correos */}
              {aggregated.emails.map(emailAddr => (
                <a
                  key={emailAddr}
                  href={`mailto:${emailAddr}`}
                  className="
                    inline-flex items-center gap-1.5 rounded-lg border
                    border-sky-500/20 bg-sky-500/5 px-2.5 py-1 font-mono
                    font-medium text-sky-600 transition-colors
                    hover:bg-sky-500/15
                    dark:text-sky-400
                  "
                >
                  <Mail className="size-3" />
                  <span>{emailAddr}</span>
                </a>
              ))}

              {/* Documentos Fiscales (DNI, NIE, CIF) */}
              {aggregated.documents.map(doc => (
                <div
                  key={doc.documentNumber}
                  className={`
                    inline-flex items-center gap-1.5 rounded-lg border px-2.5
                    py-1 font-mono font-medium
                    ${
                doc.isValid
                  ? `
                    border-purple-500/20 bg-purple-500/5 text-purple-600
                    dark:text-purple-400
                  `
                  : `
                    border-amber-500/20 bg-amber-500/5 text-amber-600
                    dark:text-amber-400
                  `
                }
                  `}
                >
                  <CreditCard className="size-3" />
                  <span>
                    {doc.type}
                    :
                    {' '}
                    {doc.documentNumber}
                  </span>
                  {doc.isValid && <span className="text-[10px] text-emerald-500">✓ Válido</span>}
                </div>
              ))}

              {/* Ubicaciones Geográficas (GPS, Plus Codes, Direcciones) */}
              {aggregated.locations.map((loc) => {
                const mapQuery = loc.coordinates
                  ? `${loc.coordinates.lat},${loc.coordinates.lng}`
                  : loc.normalized;
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

                return (
                  <a
                    key={loc.normalized}
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      inline-flex items-center gap-1.5 rounded-lg border
                      border-amber-500/20 bg-amber-500/5 px-2.5 py-1 font-medium
                      text-amber-600 transition-colors
                      hover:bg-amber-500/15
                      dark:text-amber-400
                    "
                    title="Abrir en Google Maps"
                  >
                    <MapPin className="size-3" />
                    <span>{loc.normalized}</span>
                    <ExternalLink className="size-2.5 opacity-60" />
                  </a>
                );
              })}

              {aggregated.phones.length === 0 && aggregated.emails.length === 0 && aggregated.documents.length === 0 && aggregated.locations.length === 0 && (
                <span className="text-muted-foreground italic">
                  Sin anclajes duros registrados aún. Añade un teléfono o email desde la omnibarra inferior.
                </span>
              )}
            </div>
          </div>

          {/* NAVEGACIÓN POR PESTAÑAS (Clusters Moleculares) */}
          <div className="
            flex border-b border-border bg-background px-6 text-xs font-medium
          "
          >
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`
                border-b-2 p-3 transition-colors
                ${
    activeTab === 'summary'
      ? 'border-primary font-semibold text-primary'
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              Cronología (
              {aggregated.allConnected.length}
              )
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`
                flex items-center gap-1.5 border-b-2 p-3 transition-colors
                ${
    activeTab === 'tasks'
      ? 'border-primary font-semibold text-primary'
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              <span>Tareas y Acciones</span>
              {aggregated.tasks.length > 0 && (
                <span className="
                  rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold
                  text-primary
                "
                >
                  {aggregated.tasks.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`
                flex items-center gap-1.5 border-b-2 p-3 transition-colors
                ${
    activeTab === 'documents'
      ? 'border-primary font-semibold text-primary'
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              <span>Documentos y Ofertas</span>
              {aggregated.documentsClusters.length > 0 && (
                <span className="
                  rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px]
                  font-bold text-purple-600
                  dark:text-purple-400
                "
                >
                  {aggregated.documentsClusters.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`
                flex items-center gap-1.5 border-b-2 p-3 transition-colors
                ${
    activeTab === 'notes'
      ? 'border-primary font-semibold text-primary'
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              <span>Notas y Conversaciones</span>
              {aggregated.notes.length > 0 && (
                <span className="
                  rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold
                  text-foreground
                "
                >
                  {aggregated.notes.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={`
                flex items-center gap-1.5 border-b-2 p-3 transition-colors
                ${
    activeTab === 'events'
      ? 'border-primary font-semibold text-primary'
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              <span>Citas y Agenda</span>
              {aggregated.events.length > 0 && (
                <span className="
                  rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px]
                  font-bold text-amber-600
                  dark:text-amber-400
                "
                >
                  {aggregated.events.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('synapses')}
              className={`
                flex items-center gap-1.5 border-b-2 p-3 transition-colors
                ${
    activeTab === 'synapses'
      ? 'border-primary font-semibold text-primary'
      : `
        border-transparent text-muted-foreground
        hover:text-foreground
      `
    }
              `}
            >
              <span>Red de Sinapsis</span>
              {aggregated.synapses.length > 0 && (
                <span className="
                  rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold
                  text-sky-600
                  dark:text-sky-400
                "
                >
                  {aggregated.synapses.length}
                </span>
              )}
            </button>
          </div>

          {/* CUERPO CENTRAL DE LA LENTE (Lista de Átomos Dispersos) */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading && (
              <div className="
                flex h-48 flex-col items-center justify-center gap-2
                text-muted-foreground
              "
              >
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs">Sintetizando grafo de la entidad...</span>
              </div>
            )}

            {error && (
              <div className="
                mb-4 flex items-center gap-2 rounded-xl border
                border-destructive/30 bg-destructive/10 p-4 text-xs
                text-destructive
              "
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!isLoading && (
              <div>
                {/* 1. TAB: CRONOLOGÍA / RESUMEN UNIFICADO */}
                {activeTab === 'summary' && (
                  <div className="space-y-3">
                    {aggregated.allConnected.length === 0
                      ? (
                          <div className="
                            rounded-xl border border-dashed border-border p-8
                            text-center
                          "
                          >
                            <Network className="
                              mx-auto size-8 text-muted-foreground/60
                            "
                            />
                            <h4 className="
                              mt-2 text-sm font-semibold text-foreground
                            "
                            >
                              Sin átomos vinculados todavía
                            </h4>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Escribe en la omnibarra inferior para añadir una llamada, nota o tarea asociada a este contacto.
                            </p>
                          </div>
                        )
                      : (
                          aggregated.allConnected.map((mol) => {
                            const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
                            const title = String(payload.title ?? payload.content ?? payload.name ?? mol.root.type);
                            const status = typeof payload.status === 'string' ? payload.status : 'pending';
                            const isDone = status === 'done';
                            const isTask = mol.root.type === 'task' || typeof payload.status === 'string';

                            return (
                              <div
                                key={mol.root.id}
                                className={`
                                  group flex items-start justify-between gap-3
                                  rounded-xl border p-3.5 transition-all
                                  ${
                              isDone
                                ? 'border-border/60 bg-muted/20 opacity-75'
                                : `
                                  border-border bg-card shadow-2xs
                                  hover:border-primary/40
                                `
                              }
                                `}
                              >
                                <div className="flex items-start gap-3">
                                  {isTask && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTaskStatus(mol.root.id, status)}
                                      className={`
                                        mt-0.5 flex size-5 shrink-0 items-center
                                        justify-center rounded-md border
                                        transition-all
                                        ${
                                    isDone
                                      ? `
                                        border-primary bg-primary
                                        text-primary-foreground
                                      `
                                      : `
                                        border-muted-foreground/40 bg-background
                                        hover:border-primary
                                      `
                                    }
                                      `}
                                    >
                                      {isDone && (
                                        <Check className="size-3.5 stroke-3" />
                                      )}
                                    </button>
                                  )}

                                  <div>
                                    <span className={`
                                      text-sm font-medium
                                      ${isDone
                                ? `text-muted-foreground line-through`
                                : `text-foreground`}
                                    `}
                                    >
                                      {title}
                                    </span>

                                    <div className="
                                      mt-1 flex flex-wrap items-center gap-2
                                      text-[11px] text-muted-foreground
                                    "
                                    >
                                      <span className="
                                        rounded-md bg-muted px-1.5 py-0.5
                                        font-mono uppercase
                                      "
                                      >
                                        {mol.root.type}
                                      </span>

                                      {typeof payload.dueDate === 'string' && (
                                        <span className="
                                          flex items-center gap-1 font-medium
                                          text-amber-600
                                          dark:text-amber-400
                                        "
                                        >
                                          <Clock className="size-3" />
                                          {new Date(payload.dueDate).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                                        </span>
                                      )}

                                      <span>
                                        {new Date(mol.root.createdAt).toLocaleDateString([], {
                                          day: 'numeric',
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {onOpenAtomDetail && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenAtomDetail(mol.root.id)}
                                    className="
                                      rounded-lg p-1.5 text-muted-foreground
                                      opacity-0 transition-opacity
                                      group-hover:opacity-100
                                      hover:bg-accent hover:text-foreground
                                    "
                                    title="Ver detalle del átomo"
                                  >
                                    <ExternalLink className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                  </div>
                )}

                {/* 2. TAB: TAREAS Y ACCIONES */}
                {activeTab === 'tasks' && (
                  <div className="space-y-3">
                    {aggregated.tasks.length === 0
                      ? (
                          <p className="
                            p-8 text-center text-xs text-muted-foreground
                          "
                          >
                            No hay tareas pendientes para esta entidad.
                          </p>
                        )
                      : (
                          aggregated.tasks.map((mol) => {
                            const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
                            const title = String(payload.title ?? payload.content ?? 'Tarea');
                            const status = typeof payload.status === 'string' ? payload.status : 'pending';
                            const isDone = status === 'done';

                            return (
                              <div
                                key={mol.root.id}
                                className={`
                                  flex items-center justify-between rounded-xl
                                  border p-3 transition-colors
                                  ${isDone
                                ? `border-border/60 bg-muted/20 opacity-70`
                                : `border-border bg-card`}
                                `}
                              >
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTaskStatus(mol.root.id, status)}
                                    className={`
                                      flex size-5 items-center justify-center
                                      rounded-md border
                                      ${isDone
                                ? `
                                  border-primary bg-primary
                                  text-primary-foreground
                                `
                                : `border-muted-foreground/40 bg-background`}
                                    `}
                                  >
                                    {isDone && (
                                      <Check className="size-3.5 stroke-3" />
                                    )}
                                  </button>
                                  <span className={`
                                    text-sm
                                    ${isDone
                                ? `text-muted-foreground line-through`
                                : `text-foreground`}
                                  `}
                                  >
                                    {title}
                                  </span>
                                </div>

                                {onOpenAtomDetail && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenAtomDetail(mol.root.id)}
                                    className="
                                      text-muted-foreground
                                      hover:text-foreground
                                    "
                                  >
                                    <ExternalLink className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                  </div>
                )}

                {/* 3. TAB: DOCUMENTOS Y OFERTAS */}
                {activeTab === 'documents' && (
                  <div className="space-y-3">
                    {aggregated.documentsClusters.length === 0
                      ? (
                          <p className="
                            p-8 text-center text-xs text-muted-foreground
                          "
                          >
                            No hay ofertas, presupuestos ni documentos asociados registrados.
                          </p>
                        )
                      : (
                          aggregated.documentsClusters.map((mol) => {
                            const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
                            const title = String(payload.title ?? payload.content ?? 'Documento');
                            return (
                              <div
                                key={mol.root.id}
                                className="
                                  flex items-center justify-between rounded-xl
                                  border border-purple-500/20 bg-purple-500/5
                                  p-3.5
                                "
                              >
                                <div className="flex items-center gap-3">
                                  <FileText className="
                                    size-4 text-purple-600
                                    dark:text-purple-400
                                  "
                                  />
                                  <span className="
                                    text-sm font-medium text-foreground
                                  "
                                  >
                                    {title}
                                  </span>
                                </div>

                                {onOpenAtomDetail && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenAtomDetail(mol.root.id)}
                                    className="
                                      text-muted-foreground
                                      hover:text-foreground
                                    "
                                  >
                                    <ExternalLink className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                  </div>
                )}

                {/* 4. TAB: NOTAS */}
                {activeTab === 'notes' && (
                  <div className="space-y-3">
                    {aggregated.notes.length === 0
                      ? (
                          <p className="
                            p-8 text-center text-xs text-muted-foreground
                          "
                          >
                            No hay notas registradas para esta entidad.
                          </p>
                        )
                      : (
                          aggregated.notes.map((mol) => {
                            const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
                            const title = String(payload.title ?? payload.content ?? 'Nota');
                            return (
                              <div
                                key={mol.root.id}
                                className="
                                  rounded-xl border border-border bg-card p-3.5
                                "
                              >
                                <p className="text-sm text-foreground">{title}</p>
                                <span className="
                                  mt-1 block text-[11px] text-muted-foreground
                                "
                                >
                                  {new Date(mol.root.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            );
                          })
                        )}
                  </div>
                )}

                {/* 5. TAB: CITAS Y AGENDA */}
                {activeTab === 'events' && (
                  <div className="space-y-3">
                    {aggregated.events.length === 0
                      ? (
                          <p className="
                            p-8 text-center text-xs text-muted-foreground
                          "
                          >
                            No hay eventos ni citas agendadas.
                          </p>
                        )
                      : (
                          aggregated.events.map((mol) => {
                            const payload = (mol.root.payload ?? {}) as Record<string, unknown>;
                            const title = String(payload.title ?? payload.content ?? 'Evento');
                            return (
                              <div
                                key={mol.root.id}
                                className="
                                  flex items-center justify-between rounded-xl
                                  border border-amber-500/20 bg-amber-500/5
                                  p-3.5
                                "
                              >
                                <div className="flex items-center gap-3">
                                  <Calendar className="
                                    size-4 text-amber-600
                                    dark:text-amber-400
                                  "
                                  />
                                  <span className="
                                    text-sm font-medium text-foreground
                                  "
                                  >
                                    {title}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                  </div>
                )}

                {/* 6. TAB: RED DE SINAPSIS */}
                {activeTab === 'synapses' && (
                  <div className="space-y-3">
                    {aggregated.synapses.length === 0
                      ? (
                          <p className="
                            p-8 text-center text-xs text-muted-foreground
                          "
                          >
                            No hay sinapsis explícitas configuradas en este átomo.
                          </p>
                        )
                      : (
                          aggregated.synapses.map((syn) => {
                            const neighborPayload = (syn.neighbor.payload ?? {}) as Record<string, unknown>;
                            const neighborTitle = String(neighborPayload.title ?? neighborPayload.name ?? syn.neighbor.type);

                            return (
                              <div
                                key={syn.linkId}
                                className="
                                  flex items-center justify-between rounded-xl
                                  border border-border bg-muted/20 p-3
                                "
                              >
                                <div className="flex items-center gap-2 text-xs">
                                  <Link2 className="size-3.5 text-primary" />
                                  <span className="
                                    rounded-md bg-primary/10 px-2 py-0.5
                                    font-mono font-bold text-primary
                                  "
                                  >
                                    {syn.relationType}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {syn.direction === 'outgoing' ? '→' : '←'}
                                  </span>
                                  <span className="
                                    font-semibold text-foreground
                                  "
                                  >
                                    {neighborTitle}
                                  </span>
                                  <span className="
                                    rounded-sm bg-muted px-1.5 py-0.5 font-mono
                                    text-[10px] text-muted-foreground
                                  "
                                  >
                                    {syn.neighbor.type}
                                  </span>
                                </div>

                                {onOpenAtomDetail && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenAtomDetail(syn.neighbor.id)}
                                    className="
                                      text-muted-foreground
                                      hover:text-foreground
                                    "
                                  >
                                    <ExternalLink className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* INYECTOR OMNIBARRA CONTEXTUAL (Pie de la Lente) */}
          <div className="border-t border-border bg-card p-4 backdrop-blur-xs">
            <form
              onSubmit={handleInjectQuickAtom}
              className="relative flex items-center gap-2"
            >
              <input
                type="text"
                value={omniInput}
                onChange={e => setOmniInput(e.target.value)}
                placeholder={`Añadir acción o apunte para ${aggregated.primaryName}... (ej: llamar el lunes para revisar oferta)`}
                className="
                  flex-1 rounded-xl border border-input bg-background px-4
                  py-2.5 text-sm text-foreground shadow-2xs transition-colors
                  placeholder:text-muted-foreground
                  focus:border-primary focus:ring-1 focus:ring-primary
                  focus:outline-hidden
                "
                disabled={isInjecting}
              />

              <button
                type="submit"
                disabled={isInjecting || !omniInput.trim()}
                className="
                  inline-flex items-center gap-1.5 rounded-xl bg-primary px-4
                  py-2.5 text-xs font-semibold text-primary-foreground shadow-xs
                  transition-all
                  hover:bg-primary/90
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                {isInjecting
                  ? (
                      <Loader2 className="size-4 animate-spin" />
                    )
                  : injectSuccess
                    ? (
                        <CheckCircle2 className="size-4" />
                      )
                    : (
                        <>
                          <Send className="size-3.5" />
                          <span>Inyectar</span>
                        </>
                      )}
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
