'use client';

import { ArrowRight, Loader2, Lock, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { signIn, signUp } from '@/libs/auth/auth-client';

export const SignUpForm: React.FC<{ locale: string }> = ({ locale }) => {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError } = await signUp.email({
        email,
        password,
        name,
        callbackURL: `/${locale}/dashboard`,
      });

      if (signUpError) {
        setError(signUpError.message || 'Error al crear la cuenta. Es posible que el correo ya esté registrado.');
        setIsLoading(false);
        return;
      }

      router.push(`/${locale}/verify-email?email=${encodeURIComponent(email)}`);
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
        callbackURL: `/${locale}/dashboard`,
      });
    } catch {
      setError('No se pudo iniciar el flujo de autenticación con Google');
    }
  };

  return (
    <div className="
      w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8
      shadow-2xl backdrop-blur-xl
    "
    >
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white">Crear Cuenta</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Empieza gratis en Gorila y organiza tus tareas biológicamente
        </p>
      </div>

      {error && (
        <div className="
          mb-5 rounded-lg border border-red-500/30 bg-red-950/40 p-3.5 text-sm
          text-red-300
        "
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="
            block text-xs font-semibold tracking-wider text-zinc-400 uppercase
          "
          >
            Nombre Completo
          </label>
          <div className="relative mt-1.5">
            <div className="
              pointer-events-none absolute inset-y-0 left-0 flex items-center
              pl-3.5 text-zinc-500
            "
            >
              <User className="size-4" />
            </div>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Sergio Queral"
              className="
                w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-2.5
                pr-4 pl-10 text-sm text-white placeholder-zinc-500
                focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                focus:outline-none
              "
            />
          </div>
        </div>

        <div>
          <label className="
            block text-xs font-semibold tracking-wider text-zinc-400 uppercase
          "
          >
            Correo Electrónico
          </label>
          <div className="relative mt-1.5">
            <div className="
              pointer-events-none absolute inset-y-0 left-0 flex items-center
              pl-3.5 text-zinc-500
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
                w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-2.5
                pr-4 pl-10 text-sm text-white placeholder-zinc-500
                focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                focus:outline-none
              "
            />
          </div>
        </div>

        <div>
          <label className="
            block text-xs font-semibold tracking-wider text-zinc-400 uppercase
          "
          >
            Contraseña (Mínimo 8 caracteres)
          </label>
          <div className="relative mt-1.5">
            <div className="
              pointer-events-none absolute inset-y-0 left-0 flex items-center
              pl-3.5 text-zinc-500
            "
            >
              <Lock className="size-4" />
            </div>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="
                w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-2.5
                pr-4 pl-10 text-sm text-white placeholder-zinc-500
                focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                focus:outline-none
              "
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="
            flex w-full items-center justify-center gap-2 rounded-xl
            bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg
            shadow-indigo-600/30 transition
            hover:bg-indigo-500
            disabled:opacity-50
          "
        >
          {isLoading
            ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              )
            : (
                <>
                  <span>Registrarse Gratis</span>
                  <ArrowRight className="size-4" />
                </>
              )}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-zinc-950 px-2 text-zinc-500">O también</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="
          flex w-full items-center justify-center gap-2 rounded-xl border
          border-zinc-800 bg-zinc-900/70 px-4 py-2.5 text-sm font-medium
          text-zinc-300 transition
          hover:bg-zinc-800 hover:text-white
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
        <span>Registrarse con Google</span>
      </button>

      <p className="mt-6 text-center text-xs text-zinc-500">
        ¿Ya tienes cuenta?
        {' '}
        <Link
          href={`/${locale}/sign-in`}
          className="
            font-medium text-indigo-400
            hover:text-indigo-300 hover:underline
          "
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
};
