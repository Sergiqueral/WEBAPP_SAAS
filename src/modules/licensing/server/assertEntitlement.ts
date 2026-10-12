import type {
  EntitlementContext,
  EntitlementResult,
  FeatureKey,
} from '../domain/types';
import { evaluateEntitlement } from '../domain/EntitlementEngine';
import { getTenantSubscriptionSnapshot } from './licensingRepository';

// ==========================================
// MÓDULO LICENSING: GUARDS DE SERVIDOR Y ENDPOINTS
// ==========================================

export class EntitlementError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly result: EntitlementResult;

  constructor(result: EntitlementResult) {
    super(result.reason || 'Acceso no autorizado por política de licenciamiento.');
    this.name = 'EntitlementError';
    this.code = result.code;
    this.result = result;
    // 402 Payment Required para upgrades y addons, 403 Forbidden para bloqueos manuales o archivados
    this.httpStatus = result.code === 'FORBIDDEN' || result.code === 'TENANT_ARCHIVED' ? 403 : 402;
  }
}

export async function checkFeatureEntitlement(
  organizationId: string,
  featureKey: FeatureKey,
  context?: EntitlementContext,
): Promise<EntitlementResult> {
  const snapshot = await getTenantSubscriptionSnapshot(organizationId);
  return evaluateEntitlement(snapshot, featureKey, context);
}

export async function assertFeatureEntitlement(
  organizationId: string,
  featureKey: FeatureKey,
  context?: EntitlementContext,
): Promise<EntitlementResult> {
  const result = await checkFeatureEntitlement(organizationId, featureKey, context);

  if (!result.granted) {
    throw new EntitlementError(result);
  }

  return result;
}
