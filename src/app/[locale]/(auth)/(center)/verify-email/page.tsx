import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { VerifyEmailCard } from '@/components/auth/VerifyEmailCard';

type VerifyEmailPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Verificación de Correo · Gorila SaaS',
    description: 'Confirma tu dirección de correo electrónico para acceder a Gorila.',
  };
}

export default async function VerifyEmailPage(props: VerifyEmailPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className="flex w-full justify-center">
      <Suspense fallback={<div className="text-zinc-500">Cargando...</div>}>
        <VerifyEmailCard locale={locale} />
      </Suspense>
    </div>
  );
}
