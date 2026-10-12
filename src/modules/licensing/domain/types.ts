// ==========================================
// MÓDULO LICENSING: CONTRATOS DE DOMINIO Y TIPOS
// Cero deuda técnica - Arquitectura desacoplada
// ==========================================

export type PlanTier = 'alpha_tester' | 'free' | 'pro' | 'enterprise';

export type TenantStatus = 'active' | 'dormant' | 'archived' | 'scheduled_for_deletion';

export type FeatureKey
  = | 'google_sync:read'
    | 'google_sync:write'
    | 'connector:stel_order'
    | 'members:invite'
    | 'omnibar:advanced'
    | 'exports:data'
    | (string & {});

export type AddonKey
  = | 'stel_order'
    | 'google_sync_write'
    | (string & {});

export type EntitlementEvaluationCode
  = | 'ALLOWED'
    | 'UPGRADE_REQUIRED'
    | 'ADDON_REQUIRED'
    | 'SEAT_LIMIT_REACHED'
    | 'TRIAL_EXPIRED'
    | 'TENANT_ARCHIVED'
    | 'FORBIDDEN';

export type EntitlementResult = {
  granted: boolean;
  code: EntitlementEvaluationCode;
  reason?: string;
  requiredTier?: PlanTier;
  requiredAddon?: AddonKey;
  metadata?: Record<string, unknown>;
};

export type PlanDefinition = {
  tier: PlanTier;
  name: string;
  maxFreeMembers: number;
  firstGuestTrialDays: number;
  maxOwnedFreeOrgsPerUser: number;
  features: Record<FeatureKey, boolean>;
  bypassAllRestrictions?: boolean;
};

export type TenantAddonData = {
  addonKey: AddonKey;
  status: 'active' | 'paused' | 'canceled';
  expiresAt?: Date | null;
};

export type FeatureOverrideData = {
  featureKey: FeatureKey;
  isGranted: boolean;
  reason?: string | null;
  expiresAt?: Date | null;
};

export type TenantSubscriptionSnapshot = {
  organizationId: string;
  plan: PlanTier;
  status: TenantStatus;
  isProtected?: boolean;
  lastActiveAt: Date;
  firstGuestTrialStartedAt?: Date | null;
  firstGuestTrialEndsAt?: Date | null;
  paidSeatsCount: number;
  addons?: TenantAddonData[];
  overrides?: FeatureOverrideData[];
  metadata?: Record<string, unknown>;
};

export type EntitlementContext = {
  currentMembersCount?: number;
  targetUserId?: string;
  now?: Date;
};
