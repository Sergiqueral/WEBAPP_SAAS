'use client';

import { CheckCircle2, Loader2, LogOut, Mail, RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { authClient, signOut } from '@/libs/auth/auth-client';

export function VerifyEmailCard({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const { data: session } = authClient.useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    if (cooldown > 0 || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsSent(false);

    try {
      // Intentamos reenviar la verificación
      const targetEmail = emailParam || session?.user?.email || '';


      if (!targetEmail) {
        setError('No se pudo identificar la dirección de correo para el reenvío.');
        setIsLoading(false);
        return;
      }

      await authClient.sendVerificationEmail({
        email: targetEmail,
        callbackURL: `/${locale}/dashboard`,
      });

      setIsSent(true);
      setCooldown(60);

      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError('Ocurrió un error al reenviar el correo. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push(`/${locale}/sign-in`);
    } catch {
      router.push(`/${locale}/sign-in`);
    }
  };

  return (
    <div className="
      w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8
      shadow-2xl backdrop-blur-xl
    "
    >
      <div className="text-center">
        <div className="
          mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl
          border border-emerald-500/20 bg-emerald-500/10 text-emerald-400
        "
        >
          <Mail className="size-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Confirma tu Correo
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Para garantizar la seguridad de tu espacio de trabajo, hemos enviado un enlace de activación a:
        </p>
        <div className="
          my-3 inline-block rounded-lg border border-zinc-800 bg-zinc-900/90
          px-3.5 py-1.5 font-mono text-sm font-medium text-emerald-400
        "
        >
          {emailParam || 'tu correo registrado'}
        </div>
        <p className="text-xs text-zinc-500">
          Pulsa en el enlace que encontrarás en el mensaje para acceder a tu panel.
        </p>
      </div>

      {isSent && (
        <div className="
          mt-5 flex items-center gap-2 rounded-lg border border-emerald-500/30
          bg-emerald-950/40 p-3 text-xs text-emerald-300
        "
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          <span>¡Correo de verificación reenviado con éxito! Revisa tu bandeja de entrada o spam.</span>
        </div>
      )}

      {error && (
        <div className="
          mt-5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs
          text-red-300
        "
        >
          {error}
        </div>
      )}

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={handleResend}
          disabled={isLoading || cooldown > 0}
          className="
            flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600
            py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20
            transition hover:bg-emerald-500 disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {cooldown > 0
            ? `Reenviar en ${cooldown}s`
            : 'Reenviar enlace de confirmación'}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="
            flex w-full items-center justify-center gap-2 rounded-xl border
            border-zinc-800 bg-zinc-900/60 py-2.5 text-sm font-medium text-zinc-400
            transition hover:bg-zinc-800 hover:text-white
          "
        >
          <LogOut className="size-4" />
          Iniciar sesión con otra cuenta
        </button>
      </div>

      <div className="mt-6 border-t border-zinc-900 pt-4 text-center">
        <p className="text-xs text-zinc-500">
          💡 ¿Prefieres evitar la espera de confirmación? Puedes iniciar sesión con tu cuenta de Google y entrarás al instante.
        </p>
      </div>
    </div>
  );
}
