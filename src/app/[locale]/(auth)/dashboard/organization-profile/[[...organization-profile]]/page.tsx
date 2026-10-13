import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrganizationProfileView } from '@/components/auth/OrganizationProfileView';
import { TitleBar } from '@/features/dashboard/TitleBar';

type OrganizationProfileProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: OrganizationProfileProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'OrganizationProfilePage',
  });

  return {
    title: t('title_bar'),
    description: t('title_bar_description'),
  };
}

export default async function OrganizationProfilePage(props: OrganizationProfileProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'OrganizationProfilePage',
  });

  return (
    <>
      <TitleBar
        title={t('title_bar')}
        description={t('title_bar_description')}
      />

      <OrganizationProfileView />
    </>
  );
}
