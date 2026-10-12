'use client';

import type { FeatureKey } from '../domain/types';
import { Lock } from 'lucide-react';
import React from 'react';
import { useFeatureGate } from '../hooks/useFeatureGate';
import { UpgradeModal } from './UpgradeModal';

// ==========================================
// MÓDULO LICENSING: COMPONENTE ENVOLTORIO FEATURE GATE
// Renderiza el contenido si la organización tiene la capacidad concedida
// ==========================================

export type FeatureGateProps = {
  feature: FeatureKey;
  organizationId?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockNotice?: boolean;
  lockNoticeText?: string;
};

export const FeatureGate: React.FC<FeatureGateProps> = ({
  children,
  fallback,
  feature,
  lockNoticeText,
  organizationId,
  showLockNotice = false,
}) => {
  const {
    closeUpgradeModal,
    isAllowed,
    isLoading,
    isUpgradeModalOpen,
    openUpgradeModal,
    reason,
  } = useFeatureGate(feature, organizationId);

  // Mientras carga en cliente, no mostramos bloqueo para no causar destellos
  if (isLoading || isAllowed) {
    return <>{children}</>;
  }

  return (
    <>
      {fallback
        ? (
            <>{fallback}</>
          )
        : showLockNotice
          ? (
              <button
                type="button"
                onClick={openUpgradeModal}
                className="
                  inline-flex items-center gap-1.5 rounded-lg border
                  border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium
                  text-muted-foreground transition-all
                  hover:border-primary/50 hover:bg-muted hover:text-foreground
                "
                title={reason || 'Función bloqueada por plan'}
              >
                <Lock className="size-3 text-primary" />
                <span>{lockNoticeText || 'Función Pro (Bloqueada)'}</span>
              </button>
            )
          : null}

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={closeUpgradeModal}
        featureKey={feature}
        customMessage={reason}
      />
    </>
  );
};
