/* eslint-disable no-console */
import { eq } from 'drizzle-orm';
import { systemSuperadminsSchema } from '@/modules/codex/db/schema';
import { db } from '../DB';
import { auth } from './auth';
import { member, organization, user } from './schema';

export async function seedSuperadmin(provisionalPassword = 'Gorila_Superadmin_2026!') {
  const superadminEmail = 'squeral@serveix.me';
  const superadminName = 'Sergio Queral';
  const defaultOrgName = 'SERVEIX';
  const defaultOrgSlug = 'serveix';

  console.log('🚀 Iniciando provisión automática de Superadmin y Organización en Better Auth...');

  // 1. Verificar si el usuario ya existe
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, superadminEmail),
  });

  let userId: string;

  if (!existingUser) {
    console.log(`👤 Creando usuario ${superadminEmail}...`);
    try {
      const res = await auth.api.signUpEmail({
        body: {
          name: superadminName,
          email: superadminEmail,
          password: provisionalPassword,
        },
      });

      if (res?.user?.id) {
        userId = res.user.id;
      } else {
        const found = await db.query.user.findFirst({
          where: eq(user.email, superadminEmail),
        });
        if (!found) {
          throw new Error('No se pudo obtener el ID del usuario creado');
        }
        userId = found.id;
      }
      console.log(`✅ Usuario creado exitosamente con ID: ${userId}`);
    } catch (err) {
      console.error('Error al registrar usuario en Better Auth:', err);
      throw err;
    }
  } else {
    userId = existingUser.id;
    console.log(`ℹ️ El usuario ${superadminEmail} ya existe con ID: ${userId}`);
  }

  // 2. Verificar o crear la organización SERVEIX
  const existingOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, defaultOrgSlug),
  });

  let orgId: string;

  if (!existingOrg) {
    console.log(`🏢 Creando organización predeterminada ${defaultOrgName}...`);
    orgId = `org_${defaultOrgSlug}_master`;
    await db.insert(organization).values({
      id: orgId,
      name: defaultOrgName,
      slug: defaultOrgSlug,
    }).onConflictDoNothing();
    console.log(`✅ Organización creada con ID: ${orgId}`);
  } else {
    orgId = existingOrg.id;
    console.log(`ℹ️ Organización ${defaultOrgName} existente con ID: ${orgId}`);
  }

  // 3. Vincular usuario a la organización como owner en Better Auth member
  const existingMember = await db.query.member.findFirst({
    where: eq(member.userId, userId),
  });

  if (!existingMember) {
    console.log(`🤝 Vinculando ${superadminEmail} como owner de ${defaultOrgName}...`);
    await db.insert(member).values({
      id: `member_${userId}_${orgId}`,
      organizationId: orgId,
      userId,
      role: 'owner',
    }).onConflictDoNothing();
    console.log('✅ Vinculación de equipo completada.');
  }

  // 4. Asegurar registro en system_superadmins
  await db.insert(systemSuperadminsSchema).values({
    userId,
    email: superadminEmail,
    role: 'superadmin',
    isGranted: true,
    notes: 'Cuenta superadmin soberana migrada a Better Auth (0€)',
  }).onConflictDoNothing();

  console.log('🛡️ Registro en system_superadmins verificado y asegurado.');
  console.log('🎉 PROVISIÓN COMPLETADA EXITOSAMENTE');
  console.log(`📧 Email: ${superadminEmail}`);
  console.log(`🔑 Contraseña provisional: ${provisionalPassword}`);
  console.log(`🏢 Organización activa: ${defaultOrgName} (${orgId})`);
}

// Ejecutar si se llama directamente
if (require.main === module || process.argv[1]?.includes('seed-superadmin')) {
  seedSuperadmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal seed error:', err);
      process.exit(1);
    });
}
