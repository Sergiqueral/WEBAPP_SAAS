'use client';

import { Check, KeyRound, Loader2, Mail, ShieldCheck, User, Wrench } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import { authClient } from '@/libs/auth/auth-client';
import { SuperadminPanelModal } from '@/modules/licensing/components/SuperadminPanelModal';

export const UserProfileView: React.FC = () => {
  const { data: session } = authClient.useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSuperadminModalOpen, setIsSuperadminModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!session) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Inicie sesión para ver su perfil.
      </div>
    );
  }

  const { user } = session;
  const email = user.email?.toLowerCase() || '';
  const isSuperadmin = email === 'squeral@serveix.me' || email.endsWith('@serveix.me');
  const activeOrgId = (session.session as { activeOrganizationId?: string | null })?.activeOrganizationId || 'org_serveix_master';

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message || 'No se pudo cambiar la contraseña. Verifique su contraseña actual.' });
      } else {
        setMessage({ type: 'success', text: '¡Contraseña actualizada con éxito!' });
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch {
      setMessage({ type: 'error', text: 'Error inesperado al cambiar la contraseña.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Tarjeta de Información de Cuenta */}
      <div className="
        rounded-2xl border border-border bg-card p-6 text-card-foreground
        shadow-sm
      "
      >
        <div className="
          flex items-center justify-between border-b border-border pb-4
        "
        >
          <div className="flex items-center gap-3">
            <div className="
              flex size-12 items-center justify-center rounded-xl bg-primary
              text-lg font-bold text-primary-foreground shadow-xs
            "
            >
              {user.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div>
              <h3 className="
                flex items-center gap-2 text-lg font-bold text-foreground
              "
              >
                <span>{user.name || 'Usuario'}</span>
                {isSuperadmin && (
                  <span className="
                    inline-flex items-center gap-1 rounded-sm border
                    border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs
                    font-semibold text-amber-600
                    dark:text-amber-400
                  "
                  >
                    <ShieldCheck className="size-3.5" />
                    Superadmin
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">
                ID:
                {' '}
                {user.id}
              </p>
            </div>
          </div>
        </div>

        <div className="
          mt-4 grid grid-cols-1 gap-4
          sm:grid-cols-2
        "
        >
          <div className="rounded-xl border border-border bg-muted/40 p-3.5">
            <div className="
              flex items-center gap-2 text-xs font-medium text-muted-foreground
            "
            >
              <Mail className="size-3.5 text-primary" />
              <span>Correo Electrónico</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{user.email}</p>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-3.5">
            <div className="
              flex items-center gap-2 text-xs font-medium text-muted-foreground
            "
            >
              <User className="size-3.5 text-primary" />
              <span>Estado de la Cuenta</span>
            </div>
            <p className="
              mt-1 text-sm font-semibold text-emerald-600
              dark:text-emerald-400
            "
            >
              Activo (PostgreSQL Gorila DB)
            </p>
          </div>
        </div>
      </div>

      {/* Tarjeta de Superadmin si aplica */}
      {isSuperadmin && (
        <div className="
          rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 shadow-sm
          dark:bg-amber-950/20
        "
        >
          <div className="
            flex flex-col justify-between gap-4
            sm:flex-row sm:items-center
          "
          >
            <div>
              <h4 className="
                flex items-center gap-2 text-base font-semibold text-amber-700
                dark:text-amber-400
              "
              >
                <ShieldCheck className="size-5" />
                <span>Consola de Superadministrador</span>
              </h4>
              <p className="
                mt-1 text-xs text-amber-900/80
                dark:text-amber-200/70
              "
              >
                Tienes permisos maestros sobre Gorila SaaS. Accede a la gestión global de usuarios, empresas y suscripciones.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/admin"
                className="
                  inline-flex items-center gap-2 rounded-xl bg-primary px-4
                  py-2.5 text-xs font-semibold text-primary-foreground shadow-xs
                  transition
                  hover:bg-primary/90
                "
              >
                <Wrench className="size-4" />
                <span>Ir al Panel de Superadmin</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsSuperadminModalOpen(true)}
                className="
                  inline-flex items-center gap-2 rounded-xl border
                  border-amber-500/40 bg-card px-3 py-2.5 text-xs font-semibold
                  text-foreground shadow-xs transition
                  hover:bg-muted
                "
              >
                Modal Rápida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjeta de Seguridad y Contraseña */}
      <div className="
        rounded-2xl border border-border bg-card p-6 text-card-foreground
        shadow-sm
      "
      >
        <h4 className="
          mb-4 flex items-center gap-2 text-base font-semibold text-foreground
        "
        >
          <KeyRound className="size-4 text-primary" />
          <span>Cambiar Contraseña</span>
        </h4>

        {message && (
          <div
            className={`
              mb-4 flex items-center gap-2 rounded-lg p-3 text-sm
              ${
          message.type === 'success'
            ? `
              border border-emerald-500/30 bg-emerald-500/10 text-emerald-700
              dark:text-emerald-300
            `
            : 'border border-destructive/30 bg-destructive/10 text-destructive'
          }
            `}
          >
            {message.type === 'success' && <Check className="size-4" />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
          <div>
            <label className="
              mb-1 block text-xs font-medium text-muted-foreground
            "
            >
              Contraseña Actual
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="
                w-full rounded-xl border border-input bg-background px-3 py-2
                text-sm text-foreground
                placeholder:text-muted-foreground
                focus:ring-2 focus:ring-ring focus:outline-none
              "
            />
          </div>

          <div>
            <label className="
              mb-1 block text-xs font-medium text-muted-foreground
            "
            >
              Nueva Contraseña (mínimo 8 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="
                w-full rounded-xl border border-input bg-background px-3 py-2
                text-sm text-foreground
                placeholder:text-muted-foreground
                focus:ring-2 focus:ring-ring focus:outline-none
              "
            />
          </div>

          <button
            type="submit"
            disabled={isUpdatingPassword}
            className="
              flex items-center justify-center gap-2 rounded-xl bg-primary px-4
              py-2 text-xs font-semibold text-primary-foreground shadow-xs
              transition
              hover:bg-primary/90
              disabled:opacity-50
            "
          >
            {isUpdatingPassword
              ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Actualizando...</span>
                  </>
                )
              : (
                  <span>Guardar Nueva Contraseña</span>
                )}
          </button>
        </form>
      </div>

      {isSuperadmin && (
        <SuperadminPanelModal
          isOpen={isSuperadminModalOpen}
          onClose={() => setIsSuperadminModalOpen(false)}
          organizationId={activeOrgId}
        />
      )}
    </div>
  );
};
