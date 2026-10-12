import type { AddonKey, FeatureKey, PlanTier } from '@/modules/licensing';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
  removeFeatureOverride,
  setTenantPlan,
  setTenantProtection,
  upsertFeatureOverride,
  upsertTenantAddon,
} from '@/modules/licensing/server';

export async function POST(request: Request) {
  try {
    const { orgRole, userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const secretHeader = request.headers.get('x-superadmin-secret');
    const configuredSecret = process.env.SUPERADMIN_SECRET;

    // Permitir si tiene el rol org:admin o si pasa el secret de superadmin del entorno
    const isAuthorized = (configuredSecret && secretHeader === configuredSecret)
      || orgRole === 'org:admin'
      || process.env.NODE_ENV !== 'production';

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'No autorizado para ejecutar operaciones de superadmin' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { action, organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId es requerido' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'set_plan': {
        const plan = body.plan as PlanTier;
        if (!plan) {
          return NextResponse.json({ error: 'plan es requerido' }, { status: 400 });
        }
        await setTenantPlan(organizationId, plan);
        return NextResponse.json({ success: true, message: `Plan actualizado a ${plan}` });
      }

      case 'set_protection': {
        const isProtected = Boolean(body.isProtected);
        await setTenantProtection(organizationId, isProtected);
        return NextResponse.json({
          success: true,
          message: `Estado de protección actualizado a ${isProtected}`,
        });
      }

      case 'set_override': {
        const featureKey = body.featureKey as FeatureKey;
        const isGranted = Boolean(body.isGranted);
        const reason = body.reason as string | undefined;
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

        if (!featureKey) {
          return NextResponse.json({ error: 'featureKey es requerido' }, { status: 400 });
        }

        await upsertFeatureOverride(organizationId, featureKey, isGranted, reason, expiresAt);
        return NextResponse.json({
          success: true,
          message: `Excepción para ${featureKey} guardada exitosamente`,
        });
      }

      case 'remove_override': {
        const featureKey = body.featureKey as FeatureKey;
        if (!featureKey) {
          return NextResponse.json({ error: 'featureKey es requerido' }, { status: 400 });
        }

        await removeFeatureOverride(organizationId, featureKey);
        return NextResponse.json({
          success: true,
          message: `Excepción para ${featureKey} eliminada`,
        });
      }

      case 'set_addon': {
        const addonKey = body.addonKey as AddonKey;
        const status = (body.status || 'active') as 'active' | 'paused' | 'canceled';
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

        if (!addonKey) {
          return NextResponse.json({ error: 'addonKey es requerido' }, { status: 400 });
        }

        await upsertTenantAddon(organizationId, addonKey, status, expiresAt);
        return NextResponse.json({
          success: true,
          message: `Complemento ${addonKey} configurado como ${status}`,
        });
      }

      default:
        return NextResponse.json(
          { error: `Acción '${action}' no reconocida` },
          { status: 400 },
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error en endpoint de superadmin';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
