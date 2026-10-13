import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UserProfileView } from '@/components/auth/UserProfileView';
import { TitleBar } from '@/features/dashboard/TitleBar';

type UserProfileProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: UserProfileProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'UserProfilePage',
  });

  return {
    title: t('title_bar'),
    description: t('title_bar_description'),
  };
}

export default async function UserProfilePage(props: UserProfileProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'UserProfilePage',
  });

  return (
    <>
      <TitleBar
        title={t('title_bar')}
        description={t('title_bar_description')}
      />

      <UserProfileView />
    </>
  );
}
