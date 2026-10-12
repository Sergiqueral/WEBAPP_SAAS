'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  Laptop,
  Maximize2,
  Moon,
  PanelTop,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useCodexPreferences } from '../domain/preferences/useCodexPreferences';

export const PreferencesModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { omnibarMode, setOmnibarMode, setTheme, theme } = useCodexPreferences();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Configuración de interfaz"
        title="Preferencias de interfaz y Omnibarra"
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
            fixed top-[50%] left-[50%] z-50 w-full max-w-md translate-[-50%]
            rounded-2xl border border-border bg-card p-6 shadow-2xl duration-200
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0
            data-[state=closed]:zoom-out-95
            data-[state=open]:animate-in data-[state=open]:fade-in-0
            data-[state=open]:zoom-in-95
          "
          >
            <div className="flex items-center justify-between border-b pb-4">
              <Dialog.Title className="
                flex items-center gap-2 text-base font-semibold text-foreground
              "
              >
                <SlidersHorizontal className="size-4 text-primary" />
                Preferencias de Interfaz
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

            <div className="space-y-6 pt-5">
              {/* Sección 1: Modo de la Omnibarra */}
              <div>
                <label className="
                  text-xs font-semibold tracking-wider text-muted-foreground
                  uppercase
                "
                >
                  Modo de Captura (Omnibarra)
                </label>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  Decide si prefieres tener la barra siempre visible y fija o acceder mediante atajo.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOmnibarMode('fixed')}
                    className={`
                      flex flex-col items-start gap-1.5 rounded-xl border p-3
                      text-left transition-all
                      ${
    omnibarMode === 'fixed'
      ? `
        border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary
      `
      : `
        border-border/60 text-foreground
        hover:border-border hover:bg-muted/40
      `
    }
                    `}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <PanelTop className="size-4" />
                      Fija en Pantalla
                    </div>
                    <span className="
                      text-[11px] leading-snug text-muted-foreground
                    "
                    >
                      Visible permanentemente arriba del feed.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOmnibarMode('floating')}
                    className={`
                      flex flex-col items-start gap-1.5 rounded-xl border p-3
                      text-left transition-all
                      ${
    omnibarMode === 'floating'
      ? `
        border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary
      `
      : `
        border-border/60 text-foreground
        hover:border-border hover:bg-muted/40
      `
    }
                    `}
                  >
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Maximize2 className="size-4" />
                      Flotante / Modal
                    </div>
                    <span className="
                      text-[11px] leading-snug text-muted-foreground
                    "
                    >
                      Oculta por defecto. Se abre con ⌘K o el FAB móvil.
                    </span>
                  </button>
                </div>
              </div>

              {/* Sección 2: Tema de Color */}
              <div>
                <label className="
                  text-xs font-semibold tracking-wider text-muted-foreground
                  uppercase
                "
                >
                  Apariencia
                </label>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  Selecciona el contraste visual según tu entorno de trabajo.
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`
                      flex items-center justify-center gap-1.5 rounded-xl border
                      py-2 text-xs font-medium transition-all
                      ${
    theme === 'light'
      ? `
        border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary
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
                      flex items-center justify-center gap-1.5 rounded-xl border
                      py-2 text-xs font-medium transition-all
                      ${
    theme === 'dark'
      ? `
        border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary
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
                      flex items-center justify-center gap-1.5 rounded-xl border
                      py-2 text-xs font-medium transition-all
                      ${
    theme === 'system'
      ? `
        border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary
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

            <div className="mt-7 flex justify-end">
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
    </>
  );
};
