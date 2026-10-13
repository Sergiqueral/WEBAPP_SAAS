import type { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { member, organization, user } from '@/libs/auth/schema';
import { getServerAuthSession } from '@/libs/auth/server-auth';
import { db } from '@/libs/DB';

export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso no autorizado: se requieren privilegios de Superadmin' },
        { status: 403 },
      );
    }

    const memberships = await db
      .select({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt,
        userId: member.userId,
        userName: user.name,
        userEmail: user.email,
        orgId: member.organizationId,
        orgName: organization.name,
        orgSlug: organization.slug,
      })
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .leftJoin(organization, eq(member.organizationId, organization.id))
      .orderBy(desc(member.createdAt));

    return NextResponse.json({
      success: true,
      memberships,
    });
  } catch (error) {
    console.error('Error fetching admin memberships:', error);
    return NextResponse.json(
      { error: 'Error al consultar las membresías' },
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
    const { action, memberId, role, userId, organizationId } = body;

    // 1. Cambiar rol de miembro
    if (action === 'change_role') {
      if (!memberId || !role) {
        return NextResponse.json(
          { error: 'Falta memberId o role' },
          { status: 400 },
        );
      }

      await db
        .update(member)
        .set({ role })
        .where(eq(member.id, memberId));

      return NextResponse.json({
        success: true,
        message: `Rol actualizado a ${role}`,
      });
    }

    // 2. Eliminar membresía
    if (action === 'remove_member') {
      if (!memberId) {
        return NextResponse.json(
          { error: 'Falta memberId' },
          { status: 400 },
        );
      }

      await db
        .delete(member)
        .where(eq(member.id, memberId));

      return NextResponse.json({
        success: true,
        message: 'Miembro desvinculado de la organización',
      });
    }

    // 3. Vincular nuevo miembro
    if (action === 'add_member') {
      if (!userId || !organizationId) {
        return NextResponse.json(
          { error: 'Falta userId u organizationId' },
          { status: 400 },
        );
      }

      const newId = crypto.randomUUID();
      await db.insert(member).values({
        id: newId,
        userId,
        organizationId,
        role: role || 'member',
      });

      return NextResponse.json({
        success: true,
        message: 'Usuario vinculado a la organización con éxito',
      });
    }

    return NextResponse.json(
      { error: `Acción desconocida: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error executing admin membership action:', error);
    return NextResponse.json(
      { error: 'Error al procesar la membresía' },
      { status: 500 },
    );
  }
}
