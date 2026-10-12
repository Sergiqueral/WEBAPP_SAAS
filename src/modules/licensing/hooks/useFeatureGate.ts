'use client';

import type { FeatureKey } from '../domain/types';
import { useEffect, useState } from 'react';

// ==========================================
// MÓDULO LICENSING: HOOK DE CAPACIDADES EN CLIENTE
// ==========================================

export type FeatureGateState = {
  isAllowed: boolean;
  isLoading: boolean;
  code: string;
  reason?: string;
  plan?: string;
  isUpgradeModalOpen: boolean;
  openUpgradeModal: () => void;
  closeUpgradeModal: () => void;
};

// Caché en memoria para evitar peticiones repetidas entre componentes
let cachedEntitlements: Record<string, unknown> | null = null;
let fetchPromise: Promise<Record<string, unknown>> | null = null;

export function clearEntitlementsCache(): void {
  cachedEntitlements = null;
  fetchPromise = null;
}

export function useFeatureGate(
  featureKey: FeatureKey,
  organizationId?: string,
): FeatureGateState {
  const [isAllowed, setIsAllowed] = useState(true); // Optimista: en alpha_tester todo es true
  const [isLoading, setIsLoading] = useState(!cachedEntitlements);
  const [code, setCode] = useState('ALLOWED');
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [plan, setPlan] = useState<string>('alpha_tester');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadEntitlements() {
      try {
        if (!cachedEntitlements) {
          if (!fetchPromise) {
            const url = organizationId
              ? `/api/v1/licensing/entitlements?organizationId=${encodeURIComponent(organizationId)}`
              : '/api/v1/licensing/entitlements';

            fetchPromise = fetch(url).then(async (res) => {
              if (!res.ok) {
                throw new Error('No se pudieron obtener las licencias');
              }
              return res.json();
            });
          }
          cachedEntitlements = await fetchPromise;
        }

        if (isMounted && cachedEntitlements) {
          const data = cachedEntitlements as {
            plan?: string;
            features?: Record<string, { granted: boolean; code: string; reason?: string }>;
          };

          setPlan(data.plan || 'alpha_tester');

          const feat = data.features?.[featureKey];
          if (feat) {
            setIsAllowed(feat.granted);
            setCode(feat.code);
            setReason(feat.reason);
          } else {
            // Si la función no está en el mapa estándar pero es alpha_tester, se permite
            setIsAllowed(data.plan === 'alpha_tester');
          }
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          // Si falla la red, en modo desarrollo o test permitimos por cortesía
          setIsAllowed(true);
          setIsLoading(false);
        }
      }
    }

    void loadEntitlements();

    return () => {
      isMounted = false;
    };
  }, [featureKey, organizationId]);

  return {
    isAllowed,
    isLoading,
    code,
    reason,
    plan,
    isUpgradeModalOpen,
    openUpgradeModal: () => setIsUpgradeModalOpen(true),
    closeUpgradeModal: () => setIsUpgradeModalOpen(false),
  };
}
