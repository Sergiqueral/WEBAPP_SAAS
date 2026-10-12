'use client';

import { useOrganization, useUser } from '@clerk/nextjs';
import * as Dialog from '@radix-ui/react-dialog';
import {
  CreditCard,
  KeyRound,
  Laptop,
  Maximize2,
  Moon,
  PanelTop,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Wrench,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { SubscriptionStatusCard, SuperadminPanelModal } from '@/modules/licensing';
import { useCodexPreferences } from '../domain/preferences/useCodexPreferences';

export const PreferencesModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'interface' | 'subscription' | 'superadmin'>('interface');
  const [isSuperadminOpen, setIsSuperadminOpen] = useState(false);
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [isKeyUnlocked, setIsKeyUnlocked] = useState(false);
  const { omnibarMode, setOmnibarMode, setTheme, theme } = useCodexPreferences();
  const { membership, organization } = useOrganization();
  const { user } = useUser();

  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
  const isOwnerEmail = userEmail.endsWith('@serveix.me') || userEmail.includes('squeral') || userEmail.includes('gorila');
  const orgId = organization?.id || user?.id || 'personal_workspace';
  const isAdmin = membership?.role === 'org:admin'
    || isOwnerEmail
    || user?.publicMetadata?.role === 'superadmin'
    || user?.id === 'user_3Kc1HOablotlg14RM5DNuHh4RKp'
    || isKeyUnlocked
    || process.env.NODE_ENV === 'development';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Configuración de interfaz"
        title="Preferencias de interfaz, suscripción y ajustes"
        className="
          flex items-center gap-1.5 rounded-lg border border-border/60
          bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-muted-foreground
          transition-all
          hover:border-primary/40 hover:bg-muted/60 hover:text-foreground
        "
      >
        <SlidersHorizontal className="size-3.5" />
        <span className="
          hidden
          sm:inline
        "
        >
          Ajustes
        </span>
      </button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="
            fixed inset-0 z-50 bg-black/50 backdrop-blur-xs
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=open]:animate-in data-[state=open]:fade-in-0
          "
          />
          <Dialog.Content className="
            fixed top-[50%] left-[50%] z-50 w-full max-w-lg translate-[-50%]
            rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=closed]:zoom-out-95
            data-[state=open]:animate-in data-[state=open]:fade-in-0
            data-[state=open]:zoom-in-95
          "
          >
            {/* Cabecera y Tabs */}
            <div className="flex items-center justify-between border-b pb-3">
              <Dialog.Title className="
                flex items-center gap-2 text-base font-semibold text-foreground
              "
              >
                <SlidersHorizontal className="size-4 text-primary" />
                Ajustes y Configuración
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Cerrar ajustes"
                  className="
                    rounded-lg p-1 text-muted-foreground transition-colors
                    hover:bg-muted hover:text-foreground
                  "
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Pestañas de navegación */}
            <div className="mt-3 flex items-center gap-1 border-b pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('interface')}
                className={`
                  flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
                  font-medium transition-all
                  ${
    activeTab === 'interface'
      ? 'bg-primary/10 text-primary'
      : `
        text-muted-foreground
        hover:bg-muted/50 hover:text-foreground
      `
    }
                `}
              >
                <PanelTop className="size-3.5" />
                <span>Interfaz</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('subscription')}
                className={`
                  flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
                  font-medium transition-all
                  ${
    activeTab === 'subscription'
      ? 'bg-primary/10 text-primary'
      : `
        text-muted-foreground
        hover:bg-muted/50 hover:text-foreground
      `
    }
                `}
              >
                <CreditCard className="size-3.5" />
                <span>Suscripción & Módulos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('superadmin')}
                className={`
                  flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
                  font-medium transition-all
                  ${
    activeTab === 'superadmin'
      ? `
        bg-amber-500/15 text-amber-600
        dark:text-amber-400
      `
      : `
        text-muted-foreground
        hover:bg-muted/50 hover:text-foreground
      `
    }
                `}
              >
                <Wrench className="size-3.5" />
                <span>Superadmin</span>
              </button>
            </div>

            <div className="pt-4">
              {/* TAB 1: INTERFAZ */}
              {activeTab === 'interface' && (
                <div className="space-y-6">
                  {/* Modo de la Omnibarra */}
                  <div>
                    <label className="
                      text-xs font-semibold tracking-wider text-muted-foreground
                      uppercase
                    "
                    >
                      Modo de Captura (Omnibarra)
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      Decide si prefieres tener la barra siempre visible y fija
                      o acceder mediante atajo.
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setOmnibarMode('fixed')}
                        className={`
                          flex flex-col items-start gap-1 rounded-xl border p-3
                          text-left transition-all
                          ${
                omnibarMode === 'fixed'
                  ? `
                    border-primary bg-primary/10 text-foreground shadow-xs
                    ring-1 ring-primary
                  `
                  : `
                    border-border/60 bg-muted/20 text-muted-foreground
                    hover:border-border hover:bg-muted/40 hover:text-foreground
                  `
                }
                        `}
                      >
                        <div className="
                          flex items-center gap-1.5 text-xs font-semibold
                          text-foreground
                        "
                        >
                          <PanelTop className="size-3.5 text-primary" />
                          Fija en Pantalla
                        </div>
                        <span className="
                          text-[11px] leading-snug text-muted-foreground
                        "
                        >
                          Visible encima de las tareas para capturar al instante.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOmnibarMode('floating')}
                        className={`
                          flex flex-col items-start gap-1 rounded-xl border p-3
                          text-left transition-all
                          ${
                omnibarMode === 'floating'
                  ? `
                    border-primary bg-primary/10 text-foreground shadow-xs
                    ring-1 ring-primary
                  `
                  : `
                    border-border/60 bg-muted/20 text-muted-foreground
                    hover:border-border hover:bg-muted/40 hover:text-foreground
                  `
                }
                        `}
                      >
                        <div className="
                          flex items-center gap-1.5 text-xs font-semibold
                          text-foreground
                        "
                        >
                          <Maximize2 className="size-3.5 text-primary" />
                          Flotante (Modal)
                        </div>
                        <span className="
                          text-[11px] leading-snug text-muted-foreground
                        "
                        >
                          Oculta por defecto. Se abre con ⌘K o el botón '+'
                          móvil.
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Tema de Color */}
                  <div>
                    <label className="
                      text-xs font-semibold tracking-wider text-muted-foreground
                      uppercase
                    "
                    >
                      Apariencia
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      Selecciona el contraste visual según tu entorno de
                      trabajo.
                    </p>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`
                          flex items-center justify-center gap-1.5 rounded-xl
                          border py-2 text-xs font-medium transition-all
                          ${
                theme === 'light'
                  ? `
                    border-primary bg-primary/10 text-primary shadow-xs ring-1
                    ring-primary
                  `
                  : `
                    border-border/60 text-muted-foreground
                    hover:border-border hover:bg-muted/40 hover:text-foreground
                  `
                }
                        `}
                      >
                        <Sun className="size-3.5" />
                        Claro
                      </button>

                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`
                          flex items-center justify-center gap-1.5 rounded-xl
                          border py-2 text-xs font-medium transition-all
                          ${
                theme === 'dark'
                  ? `
                    border-primary bg-primary/10 text-primary shadow-xs ring-1
                    ring-primary
                  `
                  : `
                    border-border/60 text-muted-foreground
                    hover:border-border hover:bg-muted/40 hover:text-foreground
                  `
                }
                        `}
                      >
                        <Moon className="size-3.5" />
                        Oscuro
                      </button>

                      <button
                        type="button"
                        onClick={() => setTheme('system')}
                        className={`
                          flex items-center justify-center gap-1.5 rounded-xl
                          border py-2 text-xs font-medium transition-all
                          ${
                theme === 'system'
                  ? `
                    border-primary bg-primary/10 text-primary shadow-xs ring-1
                    ring-primary
                  `
                  : `
                    border-border/60 text-muted-foreground
                    hover:border-border hover:bg-muted/40 hover:text-foreground
                  `
                }
                        `}
                      >
                        <Laptop className="size-3.5" />
                        Sistema
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SUSCRIPCIÓN & MÓDULOS */}
              {activeTab === 'subscription' && (
                <div className="space-y-4">
                  <SubscriptionStatusCard organizationId={orgId} />
                </div>
              )}

              {/* TAB 3: SUPERADMIN PROGRAMADOR */}
              {activeTab === 'superadmin' && (
                <div className="space-y-4">
                  {isAdmin
                    ? (
                        <div className="
                          rounded-2xl border border-amber-500/30 bg-amber-500/10
                          p-4
                        "
                        >
                          <div className="
                            flex items-center gap-2 text-xs font-bold
                            text-amber-600
                            dark:text-amber-400
                          "
                          >
                            <ShieldAlert className="size-4" />
                            <span>Acceso de Administración Activo</span>
                          </div>
                          <p className="
                            mt-1 text-xs text-amber-800/80
                            dark:text-amber-200/80
                          "
                          >
                            Como administrador o programador, puedes gestionar en vivo los planes de la organización, probar el simulador de cuotas o indultar cuentas de prueba contra el borrado.
                          </p>
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => setIsSuperadminOpen(true)}
                              className="
                                flex items-center gap-2 rounded-xl bg-amber-500
                                px-4 py-2 text-xs font-semibold text-black
                                shadow-xs transition-opacity
                                hover:opacity-90
                              "
                            >
                              <Wrench className="size-3.5" />
                              <span>Abrir Panel de Control Superadmin</span>
                            </button>
                          </div>
                        </div>
                      )
                    : (
                        <div className="
                          rounded-2xl border border-border/80 bg-muted/20 p-4
                        "
                        >
                          <div className="
                            flex items-center gap-2 text-xs font-bold
                            text-foreground
                          "
                          >
                            <KeyRound className="size-4 text-primary" />
                            <span>Desbloquear Control Superadmin</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Introduce la clave maestra de desarrollador para gestionar los planes y permisos en tiempo real:
                          </p>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (
                                secretKeyInput.trim() === 'Gorila_Superadmin_2026'
                                || secretKeyInput.trim().toLowerCase() === 'serveix'
                                || secretKeyInput.trim().toLowerCase() === 'gorila'
                              ) {
                                setIsKeyUnlocked(true);
                              } else {
                                // invalid key
                              }
                            }}
                            className="mt-3 flex gap-2"
                          >
                            <input
                              type="password"
                              value={secretKeyInput}
                              onChange={e => setSecretKeyInput(e.target.value)}
                              placeholder="Clave maestra superadmin"
                              className="
                                flex-1 rounded-xl border border-border
                                bg-background px-3 py-1.5 text-xs
                                text-foreground
                                focus:ring-2 focus:ring-primary/40
                                focus:outline-none
                              "
                            />
                            <button
                              type="submit"
                              className="
                                rounded-xl bg-primary px-3 py-1.5 text-xs
                                font-semibold text-primary-foreground shadow-xs
                                hover:opacity-90
                              "
                            >
                              Desbloquear
                            </button>
                          </form>
                        </div>
                      )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="
                  rounded-xl bg-primary px-4 py-2 text-xs font-medium
                  text-primary-foreground shadow-xs transition-opacity
                  hover:opacity-90
                "
              >
                Listo
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal independiente de Superadmin */}
      {isAdmin && (
        <SuperadminPanelModal
          isOpen={isSuperadminOpen}
          onClose={() => setIsSuperadminOpen(false)}
          organizationId={orgId}
        />
      )}
    </>
  );
};
