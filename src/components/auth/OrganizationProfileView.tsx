'use client';

import { Building2, Check, Loader2, UserPlus, Users } from 'lucide-react';
import React, { useState } from 'react';
import { authClient } from '@/libs/auth/auth-client';

export const OrganizationProfileView: React.FC = () => {
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!session) {
    return (
      <div className="p-8 text-center text-zinc-400">
        Inicie sesión para ver la organización.
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="
        rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 text-center
        text-zinc-400
      "
      >
        No hay ninguna organización seleccionada actualmente. Utiliza el selector de equipos para activar una.
      </div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      return;
    }

    setIsInviting(true);
    setMessage(null);

    try {
      const res = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      if (res.error) {
        setMessage({ type: 'error', text: res.error.message || 'Error al enviar la invitación.' });
      } else {
        setMessage({ type: 'success', text: `Invitación enviada con éxito a ${inviteEmail}.` });
        setInviteEmail('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setMessage({ type: 'error', text: msg });
    } finally {
      setIsInviting(false);
    }
  };

  const members = activeOrg.members || [];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Tarjeta de Información de la Organización */}
      <div className="
        rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl
        backdrop-blur-md
      "
      >
        <div className="flex items-center gap-4 border-b border-zinc-800 pb-5">
          <div className="
            flex size-12 items-center justify-center rounded-xl border
            border-indigo-500/30 bg-indigo-600/20 text-indigo-400
          "
          >
            <Building2 className="size-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{activeOrg.name}</h3>
            <p className="text-xs text-zinc-400">
              Slug:
              {activeOrg.slug || 'default'}
              {' '}
              · ID:
              {activeOrg.id}
            </p>
          </div>
        </div>

        {/* Invitar a un Miembro */}
        <div className="mt-6">
          <h4 className="
            mb-3 flex items-center gap-2 text-sm font-semibold text-white
          "
          >
            <UserPlus className="size-4 text-indigo-400" />
            <span>Invitar Colaborador al Equipo</span>
          </h4>

          {message && (
            <div
              className={`
                mb-4 flex items-center gap-2 rounded-lg p-3 text-sm
                ${
            message.type === 'success'
              ? `
                border border-emerald-500/30 bg-emerald-950/30 text-emerald-300
              `
              : 'border border-red-500/30 bg-red-950/30 text-red-300'
            }
              `}
            >
              {message.type === 'success' && <Check className="size-4" />}
              <span>{message.text}</span>
            </div>
          )}

          <form
            onSubmit={handleInvite}
            className="
              flex flex-col gap-2.5
              sm:flex-row
            "
          >
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="correo@colaborador.com"
              className="
                flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5
                py-2.5 text-sm text-white placeholder-zinc-500
                focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                focus:outline-none
              "
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'member' | 'admin')}
              className="
                rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5
                text-sm text-zinc-300
                focus:border-indigo-500 focus:outline-none
              "
            >
              <option value="member">Miembro</option>
              <option value="admin">Administrador</option>
            </select>
            <button
              type="submit"
              disabled={isInviting || !inviteEmail.trim()}
              className="
                flex items-center justify-center gap-2 rounded-xl bg-indigo-600
                px-4 py-2.5 text-sm font-semibold text-white shadow-md
                shadow-indigo-600/30 transition
                hover:bg-indigo-500
                disabled:opacity-50
              "
            >
              {isInviting
                ? (
                    <Loader2 className="size-4 animate-spin" />
                  )
                : (
                    <UserPlus className="size-4" />
                  )}
              <span>Enviar Invitación</span>
            </button>
          </form>
        </div>
      </div>

      {/* Lista de Miembros Actuales */}
      <div className="
        rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl
        backdrop-blur-md
      "
      >
        <h4 className="
          mb-4 flex items-center gap-2 text-sm font-semibold text-white
        "
        >
          <Users className="size-4 text-indigo-400" />
          <span>
            Miembros del Equipo (
            {members.length}
            )
          </span>
        </h4>

        <div className="divide-y divide-zinc-800/80">
          {members.map(member => (
            <div
              key={member.id}
              className="
                flex items-center justify-between py-3.5
                first:pt-0
                last:pb-0
              "
            >
              <div className="flex items-center gap-3">
                <div className="
                  flex size-9 items-center justify-center rounded-lg bg-zinc-800
                  text-xs font-semibold text-zinc-200
                "
                >
                  {member.user?.name ? member.user.name.slice(0, 2).toUpperCase() : 'US'}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{member.user?.name || member.user?.email || 'Usuario'}</p>
                  <p className="text-xs text-zinc-500">{member.user?.email}</p>
                </div>
              </div>

              <span className="
                rounded-full border border-zinc-700/50 bg-zinc-800/80 px-2.5
                py-0.5 text-xs font-medium text-zinc-300 capitalize
              "
              >
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
