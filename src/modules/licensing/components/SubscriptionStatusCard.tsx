'use client';

import type { PlanTier } from '../domain/types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Lock,
  Sparkles,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

// ==========================================
// MÓDULO LICENSING: TARJETA DE ESTADO DE SUSCRIPCIÓN
// Muestra con transparencia al usuario su plan, módulos y asientos
// ==========================================

export type SubscriptionDetails = {
  organizationId: string;
  plan: PlanTier;
  status: string;
  isProtected?: boolean;
  paidSeatsCount: number;
  firstGuestTrialEndsAt?: string | null;
  features: Record<string, { granted: boolean; code: string; reason?: string }>;
};

export const SubscriptionStatusCard: React.FC<{ organizationId?: string }> = ({
  organizationId,
}) => {
  const [data, setData] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchSubscription() {
      try {
        const url = organizationId
          ? `/api/v1/licensing/entitlements?organizationId=${encodeURIComponent(organizationId)}`
          : '/api/v1/licensing/entitlements';

        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setData(json);
            setLoading(false);
          }
        }
      } catch {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchSubscription();

    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  if (loading) {
    return (
      <div className="
        animate-pulse rounded-2xl border border-border/60 bg-card p-5
      "
      >
        <div className="h-5 w-1/3 rounded-md bg-muted" />
        <div className="mt-3 h-4 w-2/3 rounded-md bg-muted/60" />
      </div>
    );
  }

  const plan = data?.plan || 'alpha_tester';
  const isAlpha = plan === 'alpha_tester';
  const isPro = plan === 'pro' || plan === 'enterprise' || isAlpha;

  // Cálculo de días restantes de prueba del primer invitado
  let trialDaysRemaining: number | null = null;
  if (data?.firstGuestTrialEndsAt) {
    const end = new Date(data.firstGuestTrialEndsAt);
    const diff = end.getTime() - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="
      rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all
    "
    >
      {/* Cabecera del Plan */}
      <div className="
        flex flex-wrap items-center justify-between gap-3 border-b
        border-border/60 pb-4
      "
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="
              text-xs font-bold tracking-wider text-muted-foreground uppercase
            "
            >
              Tu Suscripción Activa
            </span>
            {isAlpha && (
              <span className="
                inline-flex items-center gap-1 rounded-full bg-emerald-500/15
                px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600
                dark:text-emerald-400
              "
              >
                <Sparkles className="size-3" />
                Alpha Tester (Acceso Total Gratuito)
              </span>
            )}
            {!isAlpha && plan === 'free' && (
              <span className="
                inline-flex items-center gap-1 rounded-full bg-blue-500/15
                px-2.5 py-0.5 text-[11px] font-semibold text-blue-600
                dark:text-blue-400
              "
              >
                Plan Gratuito
              </span>
            )}
            {!isAlpha && (plan === 'pro' || plan === 'enterprise') && (
              <span className="
                inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5
                py-0.5 text-[11px] font-semibold text-primary
              "
              >
                Plan Profesional
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAlpha
              ? 'Dispones de acceso 100% ilimitado a todas las funciones sin coste durante la fase de evaluación con amigos.'
              : plan === 'free'
                ? 'Plan base permanente para 1 usuario. Módulos y asientos adicionales gestionados individualmente.'
                : 'Acceso completo para equipos y sincronización bidireccional.'}
          </p>
        </div>
      </div>

      {/* Asientos y Colaboradores */}
      <div className="
        mt-4 grid grid-cols-1 gap-4
        sm:grid-cols-2
      "
      >
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
          <div className="
            flex items-center gap-2 text-xs font-bold text-foreground
          "
          >
            <Users className="size-4 text-primary" />
            <span>Asientos y Miembros</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {isAlpha
              ? 'Ilimitados durante la Alpha'
              : plan === 'free'
                ? '1 Asiento de propietario incluido'
                : `${(data?.paidSeatsCount || 0) + 1} Asientos activos`}
          </p>
          {trialDaysRemaining !== null && (
            <div className="
              mt-2 flex items-center gap-1.5 text-[11px] font-medium
              text-amber-600
              dark:text-amber-400
            "
            >
              <Clock className="size-3" />
              <span>
                Prueba 1er invitado:
                {' '}
                {trialDaysRemaining}
                {' '}
                días restantes
              </span>
            </div>
          )}
        </div>

        {/* Protección Anti-Borrado */}
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
          <div className="
            flex items-center gap-2 text-xs font-bold text-foreground
          "
          >
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Estado de la Cuenta</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {isAlpha || data?.isProtected
              ? '🛡️ Organización blindada (Indultada de borrado zombi)'
              : 'Activa (Monitor de inactividad de 60/90/180 días)'}
          </p>
        </div>
      </div>

      {/* Módulos y Conectores */}
      <div className="mt-5 space-y-2.5">
        <div className="
          text-[11px] font-bold tracking-wider text-muted-foreground uppercase
        "
        >
          Módulos y Conectores Contratados:
        </div>

        <div className="
          grid grid-cols-1 gap-2.5
          sm:grid-cols-3
        "
        >
          {/* Google Sync */}
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <div className="
              flex items-center gap-2 text-xs font-bold text-foreground
            "
            >
              <Calendar className="size-3.5 text-primary" />
              <span>Google Calendar</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
              {isPro
                ? (
                    <span className="
                      font-medium text-emerald-600
                      dark:text-emerald-400
                    "
                    >
                      ✓ Lectura y Edición
                    </span>
                  )
                : (
                    <span className="text-muted-foreground">
                      ✓ Solo Lectura (Gratis)
                    </span>
                  )}
            </div>
          </div>

          {/* STEL Order */}
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <div className="
              flex items-center gap-2 text-xs font-bold text-foreground
            "
            >
              <Database className="size-3.5 text-primary" />
              <span>STEL Order ERP</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
              {isAlpha || data?.features?.['connector:stel_order']?.granted
                ? (
                    <span className="
                      font-medium text-emerald-600
                      dark:text-emerald-400
                    "
                    >
                      ✓ Conector Activo
                    </span>
                  )
                : (
                    <span className="
                      flex items-center gap-1 text-muted-foreground
                    "
                    >
                      <Lock className="size-2.5" />
                      Complemento Mensual
                    </span>
                  )}
            </div>
          </div>

          {/* Omnibarra */}
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <div className="
              flex items-center gap-2 text-xs font-bold text-foreground
            "
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>Omnibarra Biológica</span>
            </div>
            <div className="
              mt-1.5 flex items-center gap-1.5 text-[11px] font-medium
              text-emerald-600
              dark:text-emerald-400
            "
            >
              ✓ Acceso Completo (⌘K)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
