import type { FeatureKey } from '@/modules/licensing';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { resolveTenantContext } from '@/modules/codex/domain/security/tenantContext';
import {
  evaluateEntitlement,
  getTenantSubscriptionSnapshot,
  touchTenantActivity,
} from '@/modules/licensing';

export async function GET(request: Request) {
  try {
    const { orgId: clerkOrgId, orgRole: clerkOrgRole, userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('organizationId');

    const tenantContext = await resolveTenantContext(
      userId,
      clerkOrgId,
      clerkOrgRole,
      requestedOrgId,
    );

    const organizationId = tenantContext.organizationId;

    // Monitor de actividad: registrar último acceso con throttling de 24h (sin bloquear respuesta)
    void touchTenantActivity(organizationId);

    // Obtener la suscripción activa
    const snapshot = await getTenantSubscriptionSnapshot(organizationId);

    // Evaluar capacidades clave
    const standardFeatures: FeatureKey[] = [
      'google_sync:read',
      'google_sync:write',
      'connector:stel_order',
      'members:invite',
      'omnibar:advanced',
      'exports:data',
    ];

    const evaluatedFeatures = standardFeatures.reduce<Record<string, { granted: boolean; code: string; reason?: string }>>((acc, key) => {
      const result = evaluateEntitlement(snapshot, key);
      acc[key] = {
        granted: result.granted,
        code: result.code,
        reason: result.reason,
      };
      return acc;
    }, {});

    return NextResponse.json({
      organizationId: snapshot.organizationId,
      plan: snapshot.plan,
      status: snapshot.status,
      isProtected: snapshot.isProtected,
      paidSeatsCount: snapshot.paidSeatsCount,
      firstGuestTrialEndsAt: snapshot.firstGuestTrialEndsAt,
      features: evaluatedFeatures,
      addons: snapshot.addons || [],
      overrides: snapshot.overrides || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno al consultar licencias';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
