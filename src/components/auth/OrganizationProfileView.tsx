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
      <div className="p-8 text-center text-muted-foreground">
        Inicie sesión para ver la organización.
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="
        rounded-2xl border border-border bg-card p-6 text-center
        text-muted-foreground shadow-sm
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
        rounded-2xl border border-border bg-card p-6 text-card-foreground
        shadow-sm
      "
      >
        <div className="flex items-center gap-4 border-b border-border pb-5">
          <div className="
            flex size-12 items-center justify-center rounded-xl border
            border-indigo-500/20 bg-indigo-500/10 text-indigo-600
            dark:text-indigo-400
          "
          >
            <Building2 className="size-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">{activeOrg.name}</h3>
            <p className="text-xs text-muted-foreground">
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
            mb-3 flex items-center gap-2 text-sm font-semibold text-foreground
          "
          >
            <UserPlus className="
              size-4 text-indigo-600
              dark:text-indigo-400
            "
            />
            <span>Invitar Colaborador al Equipo</span>
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
              : `
                border border-destructive/30 bg-destructive/10 text-destructive
              `
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
                flex-1 rounded-xl border border-input bg-background px-3.5
                py-2.5 text-sm text-foreground
                placeholder:text-muted-foreground
                focus:border-ring focus:ring-1 focus:ring-ring
                focus:outline-none
              "
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'member' | 'admin')}
              className="
                rounded-xl border border-input bg-background px-3.5 py-2.5
                text-sm text-foreground
                focus:border-ring focus:outline-none
              "
            >
              <option value="member">Miembro</option>
              <option value="admin">Administrador</option>
            </select>
            <button
              type="submit"
              disabled={isInviting || !inviteEmail.trim()}
              className="
                flex items-center justify-center gap-2 rounded-xl bg-primary
                px-4 py-2.5 text-sm font-semibold text-primary-foreground
                shadow-xs transition
                hover:bg-primary/90
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
        rounded-2xl border border-border bg-card p-6 text-card-foreground
        shadow-sm
      "
      >
        <h4 className="
          mb-4 flex items-center gap-2 text-sm font-semibold text-foreground
        "
        >
          <Users className="
            size-4 text-indigo-600
            dark:text-indigo-400
          "
          />
          <span>
            Miembros del Equipo (
            {members.length}
            )
          </span>
        </h4>

        <div className="divide-y divide-border">
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
                  flex size-9 items-center justify-center rounded-lg
                  bg-primary/10 text-xs font-semibold text-primary
                "
                >
                  {member.user?.name ? member.user.name.slice(0, 2).toUpperCase() : 'US'}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{member.user?.name || member.user?.email || 'Usuario'}</p>
                  <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                </div>
              </div>

              <span className="
                rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs
                font-medium text-muted-foreground capitalize
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
