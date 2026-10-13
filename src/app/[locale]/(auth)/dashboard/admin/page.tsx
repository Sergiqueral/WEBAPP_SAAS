import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AdminDashboardView } from '@/features/admin/AdminDashboardView';
import { getServerAuthSession } from '@/libs/auth/server-auth';

export const metadata: Metadata = {
  title: 'Panel de Superadministrador | Gorila SaaS',
  description: 'Control central y soberano de administración del sistema',
};

type AdminPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminDashboardPage(props: AdminPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const session = await getServerAuthSession();

  // Seguridad estricta: sólo accesible para el Superadmin
  if (!session.userId || !session.isSuperadmin) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="py-2">
      <AdminDashboardView />
    </div>
  );
}

export const dynamic = 'force-dynamic';
