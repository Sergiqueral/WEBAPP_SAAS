'use client';

import { Check, KeyRound, Loader2, Mail, ShieldCheck, User } from 'lucide-react';
import React, { useState } from 'react';
import { authClient } from '@/libs/auth/auth-client';

export const UserProfileView: React.FC = () => {
  const { data: session } = authClient.useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!session) {
    return (
      <div className="p-8 text-center text-zinc-400">
        Inicie sesión para ver su perfil.
      </div>
    );
  }

  const { user } = session;
  const email = user.email?.toLowerCase() || '';
  const isSuperadmin = email === 'squeral@serveix.me' || email.endsWith('@serveix.me');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (res.error) {
        setMessage({ type: 'error', text: res.error.message || 'Error al cambiar la contraseña. Verifique su contraseña actual.' });
      } else {
        setMessage({ type: 'success', text: 'Contraseña actualizada con éxito.' });
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setMessage({ type: 'error', text: msg });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Tarjeta de Información de Cuenta */}
      <div className="
        rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl
        backdrop-blur-md
      "
      >
        <div className="
          flex items-center justify-between border-b border-zinc-800 pb-4
        "
        >
          <div className="flex items-center gap-3">
            <div className="
              flex size-12 items-center justify-center rounded-xl
              bg-linear-to-tr from-indigo-600 to-violet-500 text-lg font-bold
              text-white shadow-md
            "
            >
              {user.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
            </div>
            <div>
              <h3 className="
                flex items-center gap-2 text-lg font-bold text-white
              "
              >
                <span>{user.name || 'Usuario'}</span>
                {isSuperadmin && (
                  <span className="
                    inline-flex items-center gap-1 rounded-sm border
                    border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs
                    font-semibold text-amber-400
                  "
                  >
                    <ShieldCheck className="size-3.5" />
                    Superadmin
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400">
                ID:
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
          <div className="
            rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5
          "
          >
            <div className="
              flex items-center gap-2 text-xs font-medium text-zinc-400
            "
            >
              <Mail className="size-3.5 text-indigo-400" />
              <span>Correo Electrónico</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-zinc-200">{user.email}</p>
          </div>

          <div className="
            rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5
          "
          >
            <div className="
              flex items-center gap-2 text-xs font-medium text-zinc-400
            "
            >
              <User className="size-3.5 text-indigo-400" />
              <span>Estado de la Cuenta</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-emerald-400">Activo (PostgreSQL Gorila DB)</p>
          </div>
        </div>
      </div>

      {/* Tarjeta de Seguridad y Contraseña */}
      <div className="
        rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl
        backdrop-blur-md
      "
      >
        <h4 className="
          mb-4 flex items-center gap-2 text-base font-semibold text-white
        "
        >
          <KeyRound className="size-4 text-indigo-400" />
          <span>Cambiar Contraseña</span>
        </h4>

        {message && (
          <div
            className={`
              mb-4 flex items-center gap-2 rounded-lg p-3 text-sm
              ${
          message.type === 'success'
            ? `border border-emerald-500/30 bg-emerald-950/30 text-emerald-300`
            : 'border border-red-500/30 bg-red-950/30 text-red-300'
          }
            `}
          >
            {message.type === 'success' && <Check className="size-4" />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Contraseña Actual
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="
                w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2
                text-sm text-white placeholder-zinc-500
                focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                focus:outline-none
              "
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
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
                w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2
                text-sm text-white placeholder-zinc-500
                focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                focus:outline-none
              "
            />
          </div>

          <button
            type="submit"
            disabled={isUpdatingPassword}
            className="
              flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4
              py-2 text-xs font-semibold text-zinc-200 transition
              hover:bg-zinc-700 hover:text-white
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
    </div>
  );
};
