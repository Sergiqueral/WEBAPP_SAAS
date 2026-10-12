'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowRight,
  CheckCircle2,
  GitFork,
  HelpCircle,
  Lightbulb,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

// ==========================================
// MÓDULO CODEX: ONBOARDING INTERACTIVO DE BIENVENIDA
// Guía al nuevo usuario en sus primeros pasos biológicos
// ==========================================

const ONBOARDING_STORAGE_KEY = 'codex_onboarding_completed';

export const OnboardingWizard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [interactiveInput, setInteractiveInput] = useState(
    '// Revisar propuesta de arquitectura #lanzamiento @ana mañana',
  );

  useEffect(() => {
    // Comprobar si ya se completó el onboarding
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!completed) {
      // Abrir sutilmente tras medio segundo para dar tiempo a renderizar
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  const handleResetAndOpen = () => {
    setStep(1);
    setIsOpen(true);
  };

  return (
    <>
      {/* Botón discreto en la barra para volver a abrir el tutorial */}
      <button
        type="button"
        onClick={handleResetAndOpen}
        title="Ver tutorial de bienvenida y atajos"
        className="
          flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30
          px-2 py-1.5 text-xs font-medium text-muted-foreground transition-all
          hover:border-primary/40 hover:bg-muted/60 hover:text-foreground
        "
      >
        <HelpCircle className="size-3.5 text-primary" />
        <span className="
          hidden
          md:inline
        "
        >
          Guía
        </span>
      </button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="
            fixed inset-0 z-50 bg-black/60 backdrop-blur-xs
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
            {/* Cabecera y Pasos */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="
                  flex size-6 items-center justify-center rounded-full
                  bg-primary text-xs font-bold text-primary-foreground
                "
                >
                  {step}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  de 3 · Onboarding Gorila
                </span>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Cerrar onboarding"
                  onClick={handleComplete}
                  className="
                    rounded-lg p-1 text-muted-foreground transition-colors
                    hover:bg-muted hover:text-foreground
                  "
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Contenido según el Paso */}
            <div className="pt-5">
              {step === 1 && (
                <div className="space-y-4">
                  <div className="
                    flex size-12 items-center justify-center rounded-2xl
                    bg-primary/10 text-primary
                  "
                  >
                    <Sparkles className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      ¡Bienvenido a tu Segundo Cerebro Molecular!
                    </h3>
                    <p className="mt-1.5 text-xs/relaxed text-muted-foreground">
                      Gorila no es un gestor de tareas convencional. Se basa en
                      la
                      {' '}
                      <strong>biología del dato</strong>
                      : cada pensamiento es
                      un
                      {' '}
                      <strong>átomo</strong>
                      , las relaciones forman
                      {' '}
                      <strong>sinapsis</strong>
                      , y tus proyectos se
                      organizan en
                      {' '}
                      <strong>células reactivas</strong>
                      .
                    </p>
                  </div>

                  <div className="
                    rounded-xl border border-emerald-500/20 bg-emerald-500/10
                    p-3.5
                  "
                  >
                    <div className="
                      flex items-center gap-2 text-xs font-bold text-emerald-600
                      dark:text-emerald-400
                    "
                    >
                      <CheckCircle2 className="size-4" />
                      <span>Acceso Alpha Tester Ilimitado Activo</span>
                    </div>
                    <p className="
                      mt-1 text-[11px] text-emerald-700/80
                      dark:text-emerald-300/80
                    "
                    >
                      Como evaluador amigo, dispones de acceso total y gratuito a
                      todas las capacidades para poner a prueba la velocidad y
                      ergonomía del motor.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="
                    flex size-12 items-center justify-center rounded-2xl
                    bg-primary/10 text-primary
                  "
                  >
                    <Lightbulb className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      La Magia de la Omnibarra Biológica
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Escribe con lenguaje natural. El reactor biológico detecta
                      automáticamente tareas, menciones, contextos y fechas:
                    </p>
                  </div>

                  {/* Simulador Interactivo */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={interactiveInput}
                      onChange={e => setInteractiveInput(e.target.value)}
                      placeholder="Escribe algo..."
                      className="
                        w-full rounded-xl border border-border bg-muted/30 px-3
                        py-2 font-mono text-xs text-foreground outline-hidden
                        focus:border-primary focus:ring-1 focus:ring-primary
                      "
                    />

                    {/* Fichas Biológicas Detectadas */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="
                        rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px]
                        font-semibold text-blue-600
                        dark:text-blue-400
                      "
                      >
                        ✓ Tarea (//)
                      </span>
                      <span className="
                        rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px]
                        font-semibold text-emerald-600
                        dark:text-emerald-400
                      "
                      >
                        #lanzamiento (Célula)
                      </span>
                      <span className="
                        rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px]
                        font-semibold text-purple-600
                        dark:text-purple-400
                      "
                      >
                        @ana (Miembro)
                      </span>
                      <span className="
                        rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px]
                        font-semibold text-amber-600
                        dark:text-amber-400
                      "
                      >
                        📅 mañana (Fecha)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="
                    flex size-12 items-center justify-center rounded-2xl
                    bg-primary/10 text-primary
                  "
                  >
                    <GitFork className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      ¡Todo Listo! Adapta tu Entorno
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tienes el control total de la experiencia de usuario:
                    </p>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="
                      flex items-start gap-2.5 rounded-xl border
                      border-border/60 bg-muted/20 p-2.5
                    "
                    >
                      <span className="font-mono text-xs font-bold text-primary">
                        ⌘K
                      </span>
                      <div>
                        <strong>Atajo Universal:</strong>
                        {' '}
                        Pulsa ⌘K (o Ctrl+K)
                        en cualquier momento para abrir la Omnibarra flotante.
                      </div>
                    </div>

                    <div className="
                      flex items-start gap-2.5 rounded-xl border
                      border-border/60 bg-muted/20 p-2.5
                    "
                    >
                      <span className="text-xs font-bold text-primary">📱</span>
                      <div>
                        <strong>Móvil & Táctil:</strong>
                        {' '}
                        Usa el botón '+' inferior
                        para capturar con el pulgar mientras caminas.
                      </div>
                    </div>

                    <div className="
                      flex items-start gap-2.5 rounded-xl border
                      border-border/60 bg-muted/20 p-2.5
                    "
                    >
                      <span className="text-xs font-bold text-primary">⚙️</span>
                      <div>
                        <strong>Ajustes y Suscripción:</strong>
                        {' '}
                        Desde el botón
                        'Ajustes' puedes cambiar de tema claro/oscuro o consultar
                        tus módulos activos.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navegación y Botones */}
            <div className="
              mt-6 flex items-center justify-between border-t border-border/60
              pt-4
            "
            >
              {step > 1
                ? (
                    <button
                      type="button"
                      onClick={() => setStep((step - 1) as 1 | 2)}
                      className="
                        rounded-xl border border-border px-3 py-1.5 text-xs
                        font-medium text-muted-foreground transition-colors
                        hover:bg-muted hover:text-foreground
                      "
                    >
                      Anterior
                    </button>
                  )
                : (
                    <button
                      type="button"
                      onClick={handleComplete}
                      className="
                        text-xs text-muted-foreground transition-colors
                        hover:text-foreground
                      "
                    >
                      Saltar tutorial
                    </button>
                  )}

              {step < 3
                ? (
                    <button
                      type="button"
                      onClick={() => setStep((step + 1) as 2 | 3)}
                      className="
                        flex items-center gap-1.5 rounded-xl bg-primary px-4
                        py-1.5 text-xs font-semibold text-primary-foreground
                        shadow-xs transition-opacity
                        hover:opacity-90
                      "
                    >
                      <span>Siguiente</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  )
                : (
                    <button
                      type="button"
                      onClick={handleComplete}
                      className="
                        flex items-center gap-1.5 rounded-xl bg-primary px-4
                        py-1.5 text-xs font-semibold text-primary-foreground
                        shadow-xs transition-opacity
                        hover:opacity-90
                      "
                    >
                      <Sparkles className="size-3.5" />
                      <span>¡Empezar a Crear!</span>
                    </button>
                  )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};
