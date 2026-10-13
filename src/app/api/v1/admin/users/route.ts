import type { NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { member, organization, user } from '@/libs/auth/schema';
import { getServerAuthSession } from '@/libs/auth/server-auth';
import { db } from '@/libs/DB';
import { sendVerificationEmail } from '@/libs/mail/mailer';

export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session.isSuperadmin) {
      return NextResponse.json(
        { error: 'Acceso no autorizado: se requieren privilegios de Superadmin' },
        { status: 403 },
      );
    }

    // Obtener todos los usuarios
    const usersList = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt));

    // Obtener todas las membresías con el nombre de la organización
    const memberships = await db
      .select({
        userId: member.userId,
        orgId: member.organizationId,
        orgName: organization.name,
        role: member.role,
      })
      .from(member)
      .leftJoin(organization, eq(member.organizationId, organization.id));

    // Agrupar membresías por usuario
    const orgsByUser: Record<string, Array<{ orgId: string; orgName: string; role: string }>> = {};
    for (const m of memberships) {
      if (!orgsByUser[m.userId]) {
        orgsByUser[m.userId] = [];
      }
      orgsByUser[m.userId]!.push({
        orgId: m.orgId,
        orgName: m.orgName || 'Sin Nombre',
        role: m.role,
      });
    }

    const formattedUsers = usersList.map(u => ({
      ...u,
      organizations: orgsByUser[u.id] || [],
      isSuperadmin: u.email.toLowerCase() === 'squeral@serveix.me' || u.email.toLowerCase().endsWith('@serveix.me'),
    }));

    return NextResponse.json({
      success: true,
      users: formattedUsers,
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { error: 'Error al obtener la lista de usuarios' },
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
    const { action, userId } = body;

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Parámetros incompletos (se requiere action y userId)' },
        { status: 400 },
      );
    }

    // 1. Verificar forzadamente el email
    if (action === 'verify_email') {
      await db
        .update(user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(user.id, userId));

      return NextResponse.json({
        success: true,
        message: 'Usuario verificado correctamente en PostgreSQL',
      });
    }

    // 2. Marcar como pendiente de verificación
    if (action === 'unverify_email') {
      await db
        .update(user)
        .set({ emailVerified: false, updatedAt: new Date() })
        .where(eq(user.id, userId));

      return NextResponse.json({
        success: true,
        message: 'Estado de verificación revocado',
      });
    }

    // 3. Reenviar email de activación
    if (action === 'resend_verification') {
      const [targetUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, userId));

      if (!targetUser) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 },
        );
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gorila.serveix.work';
      const fakeToken = crypto.randomUUID();
      const verificationUrl = `${appUrl}/api/auth/verify-email?token=${fakeToken}&callbackURL=${encodeURIComponent(`${appUrl}/dashboard`)}`;

      await sendVerificationEmail({
        to: targetUser.email,
        name: targetUser.name,
        verificationUrl,
      });

      return NextResponse.json({
        success: true,
        message: `Correo de activación enviado a ${targetUser.email}`,
      });
    }

    // 4. Eliminar usuario
    if (action === 'delete_user') {
      const [targetUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, userId));

      if (!targetUser) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 },
        );
      }

      // Protección contra suicidio digital o borrado del superadmin fundador
      if (
        targetUser.email.toLowerCase() === 'squeral@serveix.me'
        || targetUser.id === session.userId
      ) {
        return NextResponse.json(
          { error: 'Acción rechazada: No es posible eliminar al Superadmin Fundador' },
          { status: 400 },
        );
      }

      await db.delete(user).where(eq(user.id, userId));

      return NextResponse.json({
        success: true,
        message: `Usuario ${targetUser.email} eliminado con éxito`,
      });
    }

    return NextResponse.json(
      { error: `Acción desconocida: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    console.error('Error executing admin user action:', error);
    return NextResponse.json(
      { error: 'Error al procesar la acción de usuario' },
      { status: 500 },
    );
  }
}
