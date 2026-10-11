import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MolecularFeed } from '@/features/dashboard/MolecularFeed';
import { TitleBar } from '@/features/dashboard/TitleBar';

export default async function DashboardIndexPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'DashboardIndexPage',
  });

  return (
    <>
      <TitleBar
        title={t('title_bar')}
        description={t('title_bar_description')}
      />

      <MolecularFeed />
    </>
  );
}
