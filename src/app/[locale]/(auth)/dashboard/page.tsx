import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageMessage } from '@/features/dashboard/PageMessage';
import { TitleBar } from '@/features/dashboard/TitleBar';
import { CodexDashboardView, CodexOmnibarModal, CodexOmnibarTrigger, CodexPreferencesModal } from '@/modules/codex';

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
    <div className="space-y-6">
      <div className="
        flex flex-col gap-4
        sm:flex-row sm:items-center sm:justify-between
      "
      >
        <TitleBar
          title={t('title_bar')}
          description={t('title_bar_description')}
        />
        <div className="flex items-center gap-2">
          <CodexPreferencesModal />
          <CodexOmnibarTrigger />
        </div>
      </div>

      {/* Módulo Autónomo Codex: Feed Molecular, Kanban, Calendario y Grafo Biológico */}
      <CodexDashboardView />

      {/* Modal accesible de la Omnibarra (disparador y escucha global ⌘K) */}
      <CodexOmnibarModal />

      {/* Guía de Bienvenida de la Plantilla SaaS */}
      <div className="
        mt-12 border-t pt-6 opacity-60 transition-opacity
        hover:opacity-100
      "
      >
        <PageMessage
          icon={(
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M0 0h24v24H0z" stroke="none" />
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3M12 12l8-4.5M12 12v9M12 12L4 7.5" />
            </svg>
          )}
          title={t('message_state_title')}
          description={t.rich('message_state_description', {
            code: chunks => (
              <code className="bg-secondary text-secondary-foreground">
                {chunks}
              </code>
            ),
          })}
          button={(
            <>
              <div className="
                mt-2 text-sm font-light whitespace-pre-wrap
                text-muted-foreground
              "
              >
                <p>{t('message_state_alternative')}</p>
                <p className="
                  mt-2 font-medium text-amber-600
                  dark:text-amber-400
                "
                >
                  {t('max_message')}
                </p>
              </div>
            </>
          )}
        />
      </div>
    </div>
  );
}
