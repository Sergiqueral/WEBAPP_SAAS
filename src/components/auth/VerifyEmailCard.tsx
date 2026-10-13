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
      w-full max-w-md rounded-2xl border border-border bg-card p-8
      text-card-foreground shadow-xl
    "
    >
      <div className="text-center">
        <div className="
          mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl
          border border-primary/20 bg-primary/10 text-primary
        "
        >
          <Mail className="size-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Confirma tu Correo
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Para garantizar la seguridad de tu espacio de trabajo, hemos enviado un enlace de activación a:
        </p>
        <div className="
          my-3 inline-block rounded-lg border border-border bg-muted/50 px-3.5
          py-1.5 font-mono text-sm font-medium text-foreground
        "
        >
          {emailParam || 'tu correo registrado'}
        </div>
        <p className="text-xs text-muted-foreground">
          Pulsa en el enlace que encontrarás en el mensaje para acceder a tu panel.
        </p>
      </div>

      {isSent && (
        <div className="
          mt-5 flex items-center gap-2 rounded-lg border border-emerald-500/30
          bg-emerald-500/10 p-3 text-xs text-emerald-700
          dark:text-emerald-300
        "
        >
          <CheckCircle2 className="
            size-4 shrink-0 text-emerald-600
            dark:text-emerald-400
          "
          />
          <span>¡Correo de verificación reenviado con éxito! Revisa tu bandeja de entrada o spam.</span>
        </div>
      )}

      {error && (
        <div className="
          mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3
          text-xs text-destructive
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
            flex w-full items-center justify-center gap-2 rounded-xl bg-primary
            py-2.5 text-sm font-semibold text-primary-foreground shadow-xs
            transition
            hover:bg-primary/90
            disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          {isLoading
            ? (
                <Loader2 className="size-4 animate-spin" />
              )
            : (
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
            border-border bg-background py-2.5 text-sm font-medium
            text-muted-foreground transition-colors
            hover:bg-muted hover:text-foreground
          "
        >
          <LogOut className="size-4" />
          Iniciar sesión con otra cuenta
        </button>
      </div>

      <div className="mt-6 border-t border-border pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          💡 ¿Prefieres evitar la espera de confirmación? Puedes iniciar sesión con tu cuenta de Google y entrarás al instante.
        </p>
      </div>
    </div>
  );
}
