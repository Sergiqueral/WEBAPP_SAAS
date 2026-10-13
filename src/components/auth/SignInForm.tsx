'use client';

import { ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState } from 'react';
import { signIn } from '@/libs/auth/auth-client';

export const SignInForm: React.FC<{ locale: string }> = ({ locale }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || `/${locale}/dashboard`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn.email({
        email,
        password,
        callbackURL: redirect,
      });

      if (signInError) {
        setError(signInError.message || 'Credenciales incorrectas. Verifique su correo y contraseña.');
        setIsLoading(false);
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con el servidor';
      setError(msg);
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: redirect,
      });
    } catch {
      setError('No se pudo iniciar el flujo de autenticación con Google');
    }
  };

  return (
    <div className="
      w-full max-w-md rounded-2xl border border-border bg-card p-8
      text-card-foreground shadow-xl
    "
    >
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Iniciar Sesión</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Accede a tu espacio de trabajo en Gorila
        </p>
      </div>

      {error && (
        <div className="
          mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5
          text-sm text-destructive
        "
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="
            block text-xs font-semibold tracking-wider text-muted-foreground
            uppercase
          "
          >
            Correo Electrónico
          </label>
          <div className="relative mt-1.5">
            <div className="
              pointer-events-none absolute inset-y-0 left-0 flex items-center
              pl-3.5 text-muted-foreground
            "
            >
              <Mail className="size-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="
                w-full rounded-xl border border-input bg-background py-2.5 pr-4
                pl-10 text-sm text-foreground
                placeholder:text-muted-foreground
                focus:ring-2 focus:ring-ring focus:outline-none
              "
            />
          </div>
        </div>

        <div>
          <label className="
            block text-xs font-semibold tracking-wider text-muted-foreground
            uppercase
          "
          >
            Contraseña
          </label>
          <div className="relative mt-1.5">
            <div className="
              pointer-events-none absolute inset-y-0 left-0 flex items-center
              pl-3.5 text-muted-foreground
            "
            >
              <Lock className="size-4" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="
                w-full rounded-xl border border-input bg-background py-2.5 pr-4
                pl-10 text-sm text-foreground
                placeholder:text-muted-foreground
                focus:ring-2 focus:ring-ring focus:outline-none
              "
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="
            flex w-full items-center justify-center gap-2 rounded-xl bg-primary
            px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs
            transition
            hover:bg-primary/90
            disabled:opacity-50
          "
        >
          {isLoading
            ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Verificando...</span>
                </>
              )
            : (
                <>
                  <span>Entrar al Sistema</span>
                  <ArrowRight className="size-4" />
                </>
              )}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">O también</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="
          flex w-full items-center justify-center gap-2 rounded-xl border
          border-border bg-background px-4 py-2.5 text-sm font-medium
          text-foreground transition-colors
          hover:bg-muted
        "
      >
        <svg className="size-4" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
          />
          <path
            fill="#FBBC05"
            d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
          />
          <path
            fill="#34A853"
            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
          />
        </svg>
        <span>Continuar con Google</span>
      </button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        ¿Aún no tienes cuenta?
        {' '}
        <Link
          href={`/${locale}/sign-up`}
          className="
            font-medium text-primary
            hover:underline
          "
        >
          Crear una cuenta gratis
        </Link>
      </p>
    </div>
  );
};
