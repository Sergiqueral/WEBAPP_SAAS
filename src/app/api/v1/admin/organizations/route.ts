import type { NextRequest } from 'next/server';
import { count, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { member, organization } from '@/libs/auth/schema';
import { getServerAuthSession } from '@/libs/auth/server-auth';
import { db } from '@/libs/DB';
import { tenantSubscriptionsSchema } from '@/modules/licensing/db/schema';

export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso no autorizado: se requieren privilegios de Superadmin' },
        { status: 403 },
      );
    }

    // 1. Obtener todas las organizaciones
    const orgsList = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        createdAt: organization.createdAt,
      })
      .from(organization)
      .orderBy(desc(organization.createdAt));

    // 2. Obtener suscripciones de tenant
    const subscriptions = await db
      .select()
      .from(tenantSubscriptionsSchema);

    const subMap = new Map(subscriptions.map(s => [s.organizationId, s]));

    // 3. Obtener conteo de miembros por organización
    const memberCounts = await db
      .select({
        orgId: member.organizationId,
        count: count(member.id),
      })
      .from(member)
      .groupBy(member.organizationId);

    const memberMap = new Map(memberCounts.map(m => [m.orgId, Number(m.count) || 0]));

    // 4. Formatear respuesta
    const formattedOrgs = orgsList.map((org) => {
      const sub = subMap.get(org.id);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        createdAt: org.createdAt,
        memberCount: memberMap.get(org.id) || 0,
        plan: sub?.plan || 'free',
        status: sub?.status || 'active',
        isProtected: sub?.isProtected || false,
        isMaster: org.id === 'org_serveix_master',
      };
    });

    return NextResponse.json({
      success: true,
      organizations: formattedOrgs,
    });
  } catch (error) {
    console.error('Error fetching admin organizations:', error);
    return NextResponse.json(
      { error: 'Error al consultar las organizaciones' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso no autorizado: se requieren privilegios de Superadmin' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { action, organizationId, plan, isProtected, status } = body;

    if (!action || !organizationId) {
      return NextResponse.json(
        { error: 'Parámetros incompletos (se requiere action y organizationId)' },
        { status: 400 },
      );
    }

    // Asegurar que existe registro de suscripción para la organización
    const [existingSub] = await db
      .select()
      .from(tenantSubscriptionsSchema)
      .where(eq(tenantSubscriptionsSchema.organizationId, organizationId));

    if (!existingSub) {
      await db.insert(tenantSubscriptionsSchema).values({
        organizationId,
        plan: 'free',
        status: 'active',
        isProtected: false,
      });
    }

    // 1. Cambiar plan
    if (action === 'set_plan') {
      const validPlans = ['alpha_tester', 'free', 'pro', 'enterprise'];
      if (!validPlans.includes(plan)) {
        return NextResponse.json(
          { error: `Plan no válido. Opciones: ${validPlans.join(', ')}` },
          { status: 400 },
        );
      }

      await db
        .update(tenantSubscriptionsSchema)
        .set({ plan, updatedAt: new Date() })
        .where(eq(tenantSubscriptionsSchema.organizationId, organizationId));

      return NextResponse.json({
        success: true,
        message: `Plan de la organización actualizado a ${plan}`,
      });
    }

    // 2. Alternar blindaje anti-purga
    if (action === 'set_protection') {
      const protectedValue = Boolean(isProtected);
      await db
        .update(tenantSubscriptionsSchema)
        .set({ isProtected: protectedValue, updatedAt: new Date() })
        .where(eq(tenantSubscriptionsSchema.organizationId, organizationId));

      return NextResponse.json({
        success: true,
        message: `Blindaje anti-purga ${protectedValue ? 'activado' : 'desactivado'}`,
      });
    }

    // 3. Cambiar estado
    if (action === 'set_status') {
      const validStatuses = ['active', 'dormant', 'archived'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Estado no válido. Opciones: ${validStatuses.join(', ')}` },
          { status: 400 },
        );
      }

      await db
        .update(tenantSubscriptionsSchema)
        .set({ status, updatedAt: new Date() })
        .where(eq(tenantSubscriptionsSchema.organizationId, organizationId));

      return NextResponse.json({
        success: true,
        message: `Estado actualizado a ${status}`,
      });
    }

    // 4. Eliminar organización
    if (action === 'delete_organization') {
      if (organizationId === 'org_serveix_master') {
        return NextResponse.json(
          { error: 'Acción rechazada: No es posible eliminar la organización maestra' },
          { status: 400 },
        );
      }

      // Eliminar suscripción primero
      await db
        .delete(tenantSubscriptionsSchema)
        .where(eq(tenantSubscriptionsSchema.organizationId, organizationId));

      // Eliminar organización (cascada a members)
      await db
        .delete(organization)
        .where(eq(organization.id, organizationId));

      return NextResponse.json({
        success: true,
        message: 'Organización eliminada con éxito',
      });
    }

    return NextResponse.json(
      { error: `Acción desconocida: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error executing admin org action:', error);
    return NextResponse.json(
      { error: 'Error al procesar la acción de organización' },
      { status: 500 },
    );
  }
}
