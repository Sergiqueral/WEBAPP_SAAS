import { count, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { member, organization, user } from '@/libs/auth/schema';
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

    // Estadísticas de usuarios
    const [userStats] = await db
      .select({
        total: count(user.id),
        verified: count(sql`CASE WHEN ${user.emailVerified} = true THEN 1 END`),
        unverified: count(sql`CASE WHEN ${user.emailVerified} = false THEN 1 END`),
      })
      .from(user);

    // Estadísticas de organizaciones
    const [orgStats] = await db
      .select({
        total: count(organization.id),
      })
      .from(organization);

    // Conteo de suscripciones por plan
    const subBreakdown = await db
      .select({
        plan: tenantSubscriptionsSchema.plan,
        count: count(tenantSubscriptionsSchema.id),
      })
      .from(tenantSubscriptionsSchema)
      .groupBy(tenantSubscriptionsSchema.plan);

    const plansCount: Record<string, number> = {
      alpha_tester: 0,
      free: 0,
      pro: 0,
      enterprise: 0,
    };
    for (const item of subBreakdown) {
      plansCount[item.plan] = Number(item.count) || 0;
    }

    // Total membresías
    const [memberStats] = await db
      .select({
        total: count(member.id),
      })
      .from(member);

    // Estado de salud del sistema
    const dbConnected = true;
    const smtpConfigured = Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
    );
    const oauthConfigured = Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    );

    return NextResponse.json({
      success: true,
      stats: {
        users: {
          total: Number(userStats?.total || 0),
          verified: Number(userStats?.verified || 0),
          unverified: Number(userStats?.unverified || 0),
        },
        organizations: {
          total: Number(orgStats?.total || 0),
          plans: plansCount,
        },
        memberships: {
          total: Number(memberStats?.total || 0),
        },
        system: {
          dbConnected,
          smtpConfigured,
          oauthConfigured,
          smtpUser: process.env.SMTP_USER ? 'soporte@serveix.me' : null,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    return NextResponse.json(
      { error: 'Error al consultar métricas del sistema' },
      { status: 500 },
    );
  }
}
