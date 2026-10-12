'use client';

import type { PlanTier } from '../domain/types';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Database,
  Shield,
  ShieldAlert,
  Sliders,
  Wrench,
  X,
} from 'lucide-react';
import React, { useState } from 'react';

// ==========================================
// MÓDULO LICENSING: PANEL VISUAL DE SUPERADMIN Y TESTING
// Control de planes, add-ons, indultos y simulador de roles
// ==========================================

export type SuperadminPanelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  currentPlan?: PlanTier;
  isProtected?: boolean;
  onPlanChanged?: () => void;
};

export const SuperadminPanelModal: React.FC<SuperadminPanelModalProps> = ({
  currentPlan = 'alpha_tester',
  isOpen,
  isProtected = false,
  onClose,
  onPlanChanged,
  organizationId,
}) => {
  const [targetOrgId, setTargetOrgId] = useState<string>(organizationId);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(currentPlan);
  const [protectedState, setProtectedState] = useState<boolean>(isProtected);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const superadminHeaders = {
    'Content-Type': 'application/json',
    'x-superadmin-secret': 'Gorila_Superadmin_2026',
  };

  const handleUpdatePlan = async (newPlan: PlanTier) => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/v1/licensing/superadmin/override', {
        method: 'POST',
        headers: superadminHeaders,
        body: JSON.stringify({
          action: 'set_plan',
          organizationId: targetOrgId || organizationId,
          plan: newPlan,
        }),
      });

      if (res.ok) {
        setSelectedPlan(newPlan);
        setStatusMessage(`✓ Plan de la organización actualizado a '${newPlan}' en la base de datos.`);
        onPlanChanged?.();
      } else {
        const err = await res.json();
        setStatusMessage(`Error: ${err.error || 'No se pudo actualizar el plan'}`);
      }
    } catch {
      setStatusMessage('Error de conexión con el endpoint de superadmin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleProtection = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);
    const nextProtection = !protectedState;
    try {
      const res = await fetch('/api/v1/licensing/superadmin/override', {
        method: 'POST',
        headers: superadminHeaders,
        body: JSON.stringify({
          action: 'set_protection',
          organizationId: targetOrgId || organizationId,
          isProtected: nextProtection,
        }),
      });

      if (res.ok) {
        setProtectedState(nextProtection);
        setStatusMessage(
          nextProtection
            ? '✓ Organización blindada. Queda excluida de la purga de cuentas zombis.'
            : '✓ Protección eliminada. Sujeta al ciclo de vida estándar de inactividad.',
        );
        onPlanChanged?.();
      }
    } catch {
      setStatusMessage('Error de conexión al modificar la protección.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStelOrder = async (enable: boolean) => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/v1/licensing/superadmin/override', {
        method: 'POST',
        headers: superadminHeaders,
        body: JSON.stringify({
          action: 'set_addon',
          organizationId: targetOrgId || organizationId,
          addonKey: 'connector:stel_order',
          status: enable ? 'active' : 'canceled',
        }),
      });

      if (res.ok) {
        setStatusMessage(
          enable
            ? '✓ Conector STEL Order activado como complemento de pago.'
            : '✓ Conector STEL Order desactivado.',
        );
        onPlanChanged?.();
      }
    } catch {
      setStatusMessage('Error al gestionar el conector STEL Order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="
          fixed inset-0 z-50 bg-black/60 backdrop-blur-xs
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
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="
                flex size-10 items-center justify-center rounded-xl
                bg-amber-500/15 text-amber-600
                dark:text-amber-400
              "
              >
                <Wrench className="size-5" />
              </div>
              <div>
                <Dialog.Title className="
                  text-lg font-bold tracking-tight text-foreground
                "
                >
                  Panel de Superadmin Programador
                </Dialog.Title>
                <Dialog.Description className="
                  mt-0.5 text-xs text-muted-foreground
                "
                >
                  Control directo de licencias para la organización activa
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
                aria-label="Cerrar panel de superadmin"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Feedback de Estado */}
          {statusMessage && (
            <div className="
              mt-4 rounded-xl border border-border/80 bg-muted/40 p-3 text-xs
              font-medium text-foreground
            "
            >
              {statusMessage}
            </div>
          )}

          {/* Selector de Organización Target */}
          <div className="mt-4 space-y-1.5">
            <label className="
              block text-xs font-bold tracking-wider text-muted-foreground
              uppercase
            "
            >
              Organización o Usuario Destino:
            </label>
            <input
              type="text"
              value={targetOrgId}
              onChange={e => setTargetOrgId(e.target.value)}
              placeholder="ID de la Organización o Espacio de Trabajo"
              className="
                w-full rounded-xl border border-border bg-background/50 px-3
                py-2 font-mono text-xs text-foreground
                focus:ring-2 focus:ring-primary/40 focus:outline-none
              "
            />
          </div>

          {/* Selector de Plan */}
          <div className="mt-4 space-y-2">
            <label className="
              block text-xs font-bold tracking-wider text-muted-foreground
              uppercase
            "
            >
              1. Asignar Plan en Base de Datos:
            </label>
            <div className="
              grid grid-cols-2 gap-2
              sm:grid-cols-4
            "
            >
              {(['alpha_tester', 'free', 'pro', 'enterprise'] as PlanTier[]).map(
                planKey => (
                  <button
                    key={planKey}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleUpdatePlan(planKey)}
                    className={`
                      rounded-xl border p-2.5 text-xs font-semibold capitalize
                      transition-all
                      ${
                  selectedPlan === planKey
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : `
                      border-border/60 bg-muted/20 text-muted-foreground
                      hover:bg-muted/50 hover:text-foreground
                    `
                  }
                    `}
                  >
                    {planKey.replace('_', ' ')}
                  </button>
                ),
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cambia el plan real en PostgreSQL. Si seleccionas
              {' '}
              <strong>free</strong>
              , verás cómo se aplican los límites de asientos y bloqueos.
            </p>
          </div>

          {/* Blindaje Anti-Zombi */}
          <div className="
            mt-5 rounded-xl border border-border/60 bg-muted/20 p-3.5
          "
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {protectedState
                  ? (
                      <Shield className="size-5 text-emerald-500" />
                    )
                  : (
                      <ShieldAlert className="size-5 text-muted-foreground" />
                    )}
                <div>
                  <div className="text-xs font-bold text-foreground">
                    Indulto / Blindaje de Cuenta
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Exime a esta organización de la limpieza por inactividad
                    (60/90/180 días).
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleToggleProtection}
                className={`
                  rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors
                  ${
    protectedState
      ? `
        bg-emerald-500/15 text-emerald-600
        hover:bg-emerald-500/25
        dark:text-emerald-400
      `
      : `
        border border-border bg-card text-foreground
        hover:bg-muted
      `
    }
                `}
              >
                {protectedState ? 'Protegida ✓' : 'Proteger'}
              </button>
            </div>
          </div>

          {/* Add-on STEL Order */}
          <div className="
            mt-4 rounded-xl border border-border/60 bg-muted/20 p-3.5
          "
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Database className="size-5 text-primary" />
                <div>
                  <div className="text-xs font-bold text-foreground">
                    Complemento STEL Order ERP
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Activar o revocar el módulo de integración ERP para esta
                    organización.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleToggleStelOrder(true)}
                  className="
                    rounded-lg border border-border bg-card px-2.5 py-1 text-xs
                    font-medium text-foreground transition-colors
                    hover:bg-muted
                  "
                >
                  Activar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleToggleStelOrder(false)}
                  className="
                    rounded-lg border border-border bg-card px-2.5 py-1 text-xs
                    font-medium text-muted-foreground transition-colors
                    hover:bg-muted hover:text-foreground
                  "
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="
            mt-6 flex items-center justify-between border-t border-border/60
            pt-4
          "
          >
            <div className="
              flex items-center gap-1.5 text-[11px] text-muted-foreground
            "
            >
              <Sliders className="size-3" />
              <span>Modificaciones inmediatas en vivo</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="
                rounded-xl bg-primary px-4 py-2 text-xs font-semibold
                text-primary-foreground shadow-xs transition-colors
                hover:bg-primary/90
              "
            >
              Cerrar Panel
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
