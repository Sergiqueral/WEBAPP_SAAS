'use client';

import { Building2, Check, ChevronDown, Plus, Settings } from 'lucide-react';

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { authClient } from '@/libs/auth/auth-client';
import { getI18nPath } from '@/utils/Helpers';

export const OrganizationMenu = () => {
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { data: orgList } = authClient.useListOrganizations();

  if (!session) {
    return null;
  }

  const currentOrgName = activeOrg?.name || 'Espacio Personal';

  const handleSelectOrg = async (orgId: string) => {
    try {
      await authClient.organization.setActive({
        organizationId: orgId,
      });
      setIsOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Error switching organization:', err);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 rounded-lg border border-zinc-800
          bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-200 shadow-sm
          transition
          hover:bg-zinc-800
        "
      >
        <Building2 className="size-3.5 text-indigo-400" />
        <span className="
          max-w-[120px] truncate
          sm:max-w-[180px]
        "
        >
          {currentOrgName}
        </span>
        <ChevronDown className="size-3 text-zinc-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="
            absolute left-0 z-50 mt-2 w-56 rounded-xl border border-zinc-800
            bg-zinc-900 p-1.5 shadow-xl
          "
          >
            <div className="
              px-2 py-1 text-[11px] font-semibold tracking-wider text-zinc-400
              uppercase
            "
            >
              Espacio de Trabajo
            </div>

            <div className="my-1 max-h-48 space-y-0.5 overflow-y-auto">
              {orgList && orgList.length > 0
                ? (
                    orgList.map((org) => {
                      const isActive = activeOrg?.id === org.id;
                      return (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => handleSelectOrg(org.id)}
                          className={`
                            flex w-full items-center justify-between rounded-lg
                            px-2.5 py-1.5 text-left text-xs transition
                            ${
                        isActive
                          ? 'bg-indigo-600/20 font-medium text-indigo-300'
                          : `
                            text-zinc-300
                            hover:bg-zinc-800 hover:text-white
                          `
                        }
                          `}
                        >
                          <span className="truncate">{org.name}</span>
                          {isActive && (
                            <Check className="size-3.5 text-indigo-400" />
                          )}
                        </button>
                      );
                    })
                  )
                : (
                    <div className="px-2.5 py-1 text-xs text-zinc-500 italic">
                      {currentOrgName}
                    </div>
                  )}
            </div>

            <div className="my-1 border-t border-zinc-800" />

            <Link
              href={getI18nPath('/dashboard/organization-profile', locale)}
              onClick={() => setIsOpen(false)}
              className="
                flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs
                text-zinc-400 transition
                hover:bg-zinc-800 hover:text-zinc-200
              "
            >
              <Settings className="size-3.5" />
              <span>Gestionar Equipo</span>
            </Link>

            <Link
              href={getI18nPath('/onboarding/organization-selection', locale)}
              onClick={() => setIsOpen(false)}
              className="
                flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs
                text-zinc-400 transition
                hover:bg-zinc-800 hover:text-zinc-200
              "
            >
              <Plus className="size-3.5" />
              <span>Crear Organización</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
};
