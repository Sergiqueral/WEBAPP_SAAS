'use client';

import { ChevronDown, LogOut, ShieldCheck, User, Wrench } from 'lucide-react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient, signOut } from '@/libs/auth/auth-client';
import { getI18nPath } from '@/utils/Helpers';

export const UserMenu = () => {
  const router = useRouter();
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = authClient.useSession();

  if (!session) {
    return null;
  }

  const email = session.user.email?.toLowerCase() || '';
  const name = session.user.name || email.split('@')[0] || 'Usuario';
  const isSuperadmin = email === 'squeral@serveix.me' || email.endsWith('@serveix.me');
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push(`/${locale}/sign-in`);
      router.refresh();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 rounded-full border border-border
          bg-background p-1 pl-2 text-xs font-medium text-foreground
          transition-colors
          hover:bg-muted
        "
      >
        <span className="
          hidden max-w-[100px] truncate text-xs
          sm:inline
        "
        >
          {name}
        </span>
        <div className="
          flex size-7 items-center justify-center rounded-full bg-primary
          text-xs font-bold text-primary-foreground shadow-xs
        "
        >
          {initials}
        </div>
        <ChevronDown className="mr-1 size-3 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="
            absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border
            bg-popover p-2 text-popover-foreground shadow-xl
          "
          >
            <div className="border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{name}</span>
                {isSuperadmin && (
                  <span className="
                    inline-flex items-center gap-1 rounded-sm border
                    border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5
                    text-[10px] font-semibold text-amber-600
                    dark:text-amber-400
                  "
                  >
                    <ShieldCheck className="size-3" />
                    Superadmin
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
            </div>

            <div className="my-1 py-1">
              <Link
                href={getI18nPath('/dashboard/user-profile', locale)}
                onClick={() => setIsOpen(false)}
                className="
                  flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs
                  text-foreground transition-colors
                  hover:bg-muted
                "
              >
                <User className="size-4 text-muted-foreground" />
                <span>Mi Perfil</span>
              </Link>

              {isSuperadmin && (
                <Link
                  href={getI18nPath('/dashboard/admin', locale)}
                  onClick={() => setIsOpen(false)}
                  className="
                    flex w-full items-center gap-2.5 rounded-lg px-3 py-2
                    text-xs font-semibold text-amber-600 transition-colors
                    hover:bg-amber-500/10
                    dark:text-amber-400
                  "
                >
                  <Wrench className="
                    size-4 text-amber-600
                    dark:text-amber-400
                  "
                  />
                  <span>Panel de Superadmin</span>
                </Link>
              )}
            </div>

            <div className="border-t border-border pt-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="
                  flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs
                  text-destructive transition-colors
                  hover:bg-destructive/10
                "
              >
                <LogOut className="size-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
