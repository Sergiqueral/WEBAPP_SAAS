'use client';

import type { FeatureKey } from '../domain/types';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, CheckCircle2, Lock, Sparkles, X } from 'lucide-react';
import React from 'react';

// ==========================================
// MÓDULO LICENSING: MODAL INFORMATIVO DE AMPLIACIÓN
// Accesible, responsive y sin dependencias de pasarelas de pago
// ==========================================

export type UpgradeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  featureKey: FeatureKey;
  customTitle?: string;
  customMessage?: string;
};

const FEATURE_METADATA: Record<string, { title: string; planName: string; bullets: string[] }> = {
  'google_sync:write': {
    title: 'Sincronización Bidireccional con Google',
    planName: 'Plan Profesional',
    bullets: [
      'Creación y edición directa de eventos en Google Calendar.',
      'Sincronización en tiempo real de tareas y recordatorios.',
      'Asignación automática a miembros de tu organización.',
    ],
  },
  'connector:stel_order': {
    title: 'Conector Modular STEL Order ERP',
    planName: 'Complemento Mensual',
    bullets: [
      'Sincronización de pedidos, albaranes y facturas con tu ERP.',
      'Importación automática de clientes y catálogo de productos.',
      'Disparo de sinapsis operativas desde la Omnibarra.',
    ],
  },
  'members:invite': {
    title: 'Ampliación de Asientos para el Equipo',
    planName: 'Asientos Adicionales',
    bullets: [
      'Incorpora compañeros y colaboradores a tu espacio de trabajo.',
      'Control de roles, asignaciones en vivo y permisos por molécula.',
      '30 días de prueba gratuita incluidos para el primer invitado.',
    ],
  },
};

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  customMessage,
  customTitle,
  featureKey,
  isOpen,
  onClose,
}) => {
  const meta = FEATURE_METADATA[featureKey] || {
    title: customTitle || 'Capacidad Avanzada',
    planName: 'Plan Profesional',
    bullets: [
      'Acceso completo a herramientas avanzadas de automatización.',
      'Mayor capacidad de procesamiento y almacenamiento.',
      'Soporte prioritario y conectores exclusivos.',
    ],
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="
          fixed inset-0 z-50 bg-black/50 backdrop-blur-xs
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0
          data-[state=open]:animate-in data-[state=open]:fade-in-0
        "
        />
        <Dialog.Content className="
          fixed top-[50%] left-[50%] z-50 w-full max-w-lg translate-[-50%]
          rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0
          data-[state=closed]:zoom-out-95
          data-[state=open]:animate-in data-[state=open]:fade-in-0
          data-[state=open]:zoom-in-95
        "
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="
                flex size-10 items-center justify-center rounded-xl
                bg-primary/10 text-primary
              "
              >
                <Sparkles className="size-5" />
              </div>
              <div>
                <Dialog.Title className="
                  text-lg font-bold tracking-tight text-foreground
                "
                >
                  {meta.title}
                </Dialog.Title>
                <Dialog.Description className="
                  mt-0.5 text-xs text-muted-foreground
                "
                >
                  Disponible en
                  {' '}
                  {meta.planName}
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="
                  rounded-lg p-1.5 text-muted-foreground transition-colors
                  hover:bg-muted hover:text-foreground
                "
                aria-label="Cerrar modal"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Badge & Descripción */}
          <div className="
            mt-5 rounded-xl border border-border/60 bg-muted/30 p-4
          "
          >
            <div className="flex items-center gap-2">
              <span className="
                inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5
                py-0.5 text-[11px] font-semibold text-primary
              "
              >
                <Lock className="size-3" />
                {meta.planName}
              </span>
            </div>
            <p className="mt-2 text-xs/relaxed text-muted-foreground">
              {customMessage || 'Esta función requiere un plan superior o la activación del complemento mensual para tu organización.'}
            </p>
          </div>

          {/* Beneficios */}
          <div className="mt-5 space-y-2.5">
            <div className="
              text-[11px] font-bold tracking-wider text-muted-foreground
              uppercase
            "
            >
              Lo que incluye:
            </div>
            {meta.bullets.map(bullet => (
              <div
                key={bullet}
                className="flex items-start gap-2 text-xs text-foreground/90"
              >
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="
            mt-6 flex flex-col-reverse items-center justify-end gap-2.5 pt-4
            sm:flex-row
          "
          >
            <button
              type="button"
              onClick={onClose}
              className="
                w-full rounded-xl border border-border px-4 py-2 text-xs
                font-medium text-foreground transition-colors
                hover:bg-muted
                sm:w-auto
              "
            >
              Entendido
            </button>
            <button
              type="button"
              onClick={onClose}
              className="
                flex w-full items-center justify-center gap-1.5 rounded-xl
                bg-primary px-4 py-2 text-xs font-semibold
                text-primary-foreground shadow-xs transition-colors
                hover:bg-primary/90
                sm:w-auto
              "
            >
              <span>Solicitar Activación</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
