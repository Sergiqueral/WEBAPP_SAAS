import type { NextFetchEvent, NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { routing } from './libs/I18nRouting';

import { AllLocales, AppConfig } from './utils/AppConfig';

const handleI18nRouting = createMiddleware(routing);

function extractLocale(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  if (match && match[1] && AllLocales.includes(match[1])) {
    return match[1];
  }
  return AppConfig.i18n.defaultLocale;
}

function isProtectedRoute(pathname: string): boolean {
  return /^\/(?:(?:es|en|fr)\/)?(?:dashboard|onboarding)(?:\/|$)/.test(pathname);
}

function isAuthPage(pathname: string): boolean {
  return /^\/(?:(?:es|en|fr)\/)?(?:sign-in|sign-up)(?:\/|$)/.test(pathname);
}

export default async function proxy(
  request: NextRequest,
  _event: NextFetchEvent,
) {
  const { pathname } = request.nextUrl;

  // No interceptar rutas de API
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('better-auth.session_token')
    || request.cookies.get('__Secure-better-auth.session_token');

  // Protección de rutas privadas
  if (isProtectedRoute(pathname)) {
    if (!sessionCookie?.value) {
      const locale = extractLocale(pathname);
      const signInUrl = new URL(`/${locale}/sign-in`, request.url);
      signInUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Si ya tiene sesión activa y visita sign-in/sign-up, redirigir al dashboard
  if (isAuthPage(pathname) && sessionCookie?.value) {
    const locale = extractLocale(pathname);
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return handleI18nRouting(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/_next`, `/_vercel` or `monitoring`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!_next|_vercel|monitoring|.*\\..*).*)',
};
