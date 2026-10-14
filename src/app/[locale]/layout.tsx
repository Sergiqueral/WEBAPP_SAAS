import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { DemoBadge } from '@/components/DemoBadge';
import { routing } from '@/libs/I18nRouting';
import '@/styles/global.css';

export const metadata: Metadata = {
  icons: [
    {
      rel: 'apple-touch-icon',
      url: '/apple-touch-icon.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      url: '/favicon-32x32.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      url: '/favicon-16x16.png',
    },
    {
      rel: 'icon',
      url: '/favicon.ico',
    },
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var p = JSON.parse(localStorage.getItem('codex_user_preferences_v1') || '{}');
                var d = p.theme === 'dark' || (p.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (d) { document.documentElement.classList.add('dark'); }
                else { document.documentElement.classList.remove('dark'); }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider>
          {props.children}

          <DemoBadge />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
