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
          flex items-center gap-2 rounded-lg border border-border bg-background
          px-3 py-1.5 text-xs font-medium text-foreground shadow-xs
          transition-colors
          hover:bg-muted hover:text-foreground
        "
      >
        <Building2 className="
          size-3.5 text-indigo-500
          dark:text-indigo-400
        "
        />
        <span className="
          max-w-[120px] truncate
          sm:max-w-[180px]
        "
        >
          {currentOrgName}
        </span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="
            absolute left-0 z-50 mt-2 w-56 rounded-xl border border-border
            bg-popover p-1.5 text-popover-foreground shadow-xl
          "
          >
            <div className="
              px-2 py-1 text-[11px] font-semibold tracking-wider
              text-muted-foreground uppercase
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
                            px-2.5 py-1.5 text-left text-xs transition-colors
                            ${
                        isActive
                          ? 'bg-accent font-semibold text-accent-foreground'
                          : `
                            text-muted-foreground
                            hover:bg-muted hover:text-foreground
                          `
                        }
                          `}
                        >
                          <span className="truncate">{org.name}</span>
                          {isActive && (
                            <Check className="size-3.5 text-primary" />
                          )}
                        </button>
                      );
                    })
                  )
                : (
                    <div className="
                      px-2.5 py-1 text-xs text-muted-foreground italic
                    "
                    >
                      {currentOrgName}
                    </div>
                  )}
            </div>

            <div className="my-1 border-t border-border" />

            <Link
              href={getI18nPath('/dashboard/organization-profile', locale)}
              onClick={() => setIsOpen(false)}
              className="
                flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs
                text-muted-foreground transition-colors
                hover:bg-muted hover:text-foreground
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
                text-muted-foreground transition-colors
                hover:bg-muted hover:text-foreground
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
