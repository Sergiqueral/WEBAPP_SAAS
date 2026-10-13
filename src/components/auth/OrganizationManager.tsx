'use client';

import { Building2, Check, Loader2, Plus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { authClient } from '@/libs/auth/auth-client';

export const OrganizationManager: React.FC<{ locale: string }> = ({ locale }) => {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { data: orgList, isPending } = authClient.useListOrganizations();

  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectOrg = async (orgId: string) => {
    try {
      await authClient.organization.setActive({
        organizationId: orgId,
      });
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch {
      setError('No se pudo activar la organización seleccionada');
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const slug = newOrgName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');

      const res = await authClient.organization.create({
        name: newOrgName.trim(),
        slug,
      });

      if (res.data?.id) {
        await authClient.organization.setActive({
          organizationId: res.data.id,
        });
      }

      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear la organización';
      setError(msg);
      setIsCreating(false);
    }
  };

  if (!session) {
    return (
      <div className="p-8 text-center text-zinc-400">
        Inicie sesión para gestionar sus organizaciones.
      </div>
    );
  }

  return (
    <div className="
      w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8
      shadow-2xl backdrop-blur-xl
    "
    >
      <div className="mb-6">
        <h2 className="
          flex items-center gap-2.5 text-2xl font-bold tracking-tight text-white
        "
        >
          <Building2 className="size-6 text-indigo-400" />
          <span>Tus Organizaciones y Equipos</span>
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Selecciona una organización existente o crea un nuevo espacio de trabajo.
        </p>
      </div>

      {error && (
        <div className="
          mb-5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm
          text-red-300
        "
        >
          {error}
        </div>
      )}

      {/* Lista de Organizaciones */}
      <div className="mb-8 space-y-2">
        <label className="
          mb-2 block text-xs font-semibold tracking-wider text-zinc-400
          uppercase
        "
        >
          Organizaciones Disponibles
        </label>
        {isPending
          ? (
              <div className="
                flex items-center gap-2 py-4 text-sm text-zinc-400
              "
              >
                <Loader2 className="size-4 animate-spin text-indigo-400" />
                <span>Cargando equipos...</span>
              </div>
            )
          : orgList && orgList.length > 0
            ? (
                orgList.map((org) => {
                  const isActive = activeOrg?.id === org.id;
                  return (
                    <div
                      key={org.id}
                      className={`
                        flex items-center justify-between rounded-xl border p-4
                        transition
                        ${
                    isActive
                      ? 'border-indigo-500/60 bg-indigo-950/20'
                      : `
                        border-zinc-800 bg-zinc-900/40
                        hover:border-zinc-700
                      `
                    }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className="
                          flex size-10 items-center justify-center rounded-lg
                          bg-zinc-800 text-indigo-400
                        "
                        >
                          <Users className="size-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{org.name}</h4>
                          <p className="text-xs text-zinc-500">
                            ID:
                            {org.id}
                          </p>
                        </div>
                      </div>

                      {isActive
                        ? (
                            <span className="
                              flex items-center gap-1.5 rounded-full border
                              border-emerald-500/20 bg-emerald-500/10 px-3 py-1
                              text-xs font-medium text-emerald-400
                            "
                            >
                              <Check className="size-3.5" />
                              Activa
                            </span>
                          )
                        : (
                            <button
                              type="button"
                              onClick={() => handleSelectOrg(org.id)}
                              className="
                                rounded-lg bg-zinc-800 px-3 py-1.5 text-xs
                                font-medium text-zinc-200 transition
                                hover:bg-zinc-700 hover:text-white
                              "
                            >
                              Seleccionar
                            </button>
                          )}
                    </div>
                  );
                })
              )
            : (
                <div className="
                  rounded-xl border border-dashed border-zinc-800 p-6
                  text-center text-sm text-zinc-500
                "
                >
                  Aún no perteneces a ninguna organización formal. Puedes crear la primera a continuación.
                </div>
              )}
      </div>

      {/* Formulario Crear Organización */}
      <form
        onSubmit={handleCreateOrg}
        className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
      >
        <label className="
          mb-2 block text-xs font-semibold tracking-wider text-zinc-300
          uppercase
        "
        >
          Crear Nuevo Espacio de Trabajo
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            required
            value={newOrgName}
            onChange={e => setNewOrgName(e.target.value)}
            placeholder="Ej: SERVEIX Digital, Mi Empresa..."
            className="
              flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5
              text-sm text-white placeholder-zinc-500
              focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
              focus:outline-none
            "
          />
          <button
            type="submit"
            disabled={isCreating || !newOrgName.trim()}
            className="
              flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5
              text-sm font-semibold text-white shadow-md shadow-indigo-600/30
              transition
              hover:bg-indigo-500
              disabled:opacity-50
            "
          >
            {isCreating
              ? (
                  <Loader2 className="size-4 animate-spin" />
                )
              : (
                  <Plus className="size-4" />
                )}
            <span>Crear</span>
          </button>
        </div>
      </form>
    </div>
  );
};
