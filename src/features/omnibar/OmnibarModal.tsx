'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, Check, Loader2, Sparkles } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import { MolecularFootprint } from './MolecularFootprint';
import { useOmnibar } from './useOmnibar';

export type OmnibarModalProps = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  knownEntities?: Array<{ id: string; name: string }>;
  knownContexts?: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
};

export const OmnibarModal: React.FC<OmnibarModalProps> = ({
  isOpen: controlledIsOpen,
  knownContexts = [],
  knownEntities = [],
  onOpenChange,
  onSuccess,
}) => {
  const omnibar = useOmnibar({
    knownEntities,
    knownContexts,
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : omnibar.isOpen;
  const setIsOpen = (open: boolean) => {
    if (isControlled) {
      onOpenChange?.(open);
    } else {
      omnibar.setIsOpen(open);
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeSelectedIndex = omnibar.suggestions.length > 0
    ? Math.min(selectedIndex, omnibar.suggestions.length - 1)
    : 0;

  // Enfocar el input al abrir el modal con limpieza de timeout
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (isOpen) {
      timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      omnibar.reset();
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const hasSuggestions = omnibar.suggestions.length > 0;

    if (hasSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % omnibar.suggestions.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(
          prev => (prev - 1 + omnibar.suggestions.length) % omnibar.suggestions.length,
        );
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = omnibar.suggestions[safeSelectedIndex];
        if (selected) {
          omnibar.applySuggestion(selected);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      omnibar.submit();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        {/* Fondo con Glassmorphism */}
        <Dialog.Overlay className="
          fixed inset-0 z-50 animate-in bg-black/50 backdrop-blur-xs
          transition-opacity duration-200 fade-in
        "
        />

        {/* Contenedor del Modal */}
        <Dialog.Content className="
          fixed top-[12%] left-1/2 z-50 w-[94vw] max-w-2xl -translate-x-1/2
          animate-in rounded-2xl border border-border/80 bg-background/95 p-0
          shadow-2xl backdrop-blur-md transition-all duration-200 outline-none
          zoom-in-95 fade-in
          sm:top-[16%]
        "
        >
          <Dialog.Title className="sr-only">
            Omnibarra Mecánica de Captura
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Ingesta rápida de tareas y notas moleculares con @entidades, //fechas y #contextos
          </Dialog.Description>

          <div className="flex flex-col overflow-hidden rounded-2xl">
            {/* Cabecera / Caja de Entrada */}
            <div className="
              flex items-center gap-3 border-b border-border/40 px-4 py-3.5
              sm:px-5
            "
            >
              <Sparkles className="size-5 shrink-0 animate-pulse text-primary" />

              <input
                ref={inputRef}
                type="text"
                value={omnibar.rawText}
                onChange={(e) => {
                  omnibar.setRawText(e.target.value);
                  omnibar.setCursorPosition(e.target.selectionStart ?? 0);
                }}
                onKeyUp={(e) => {
                  omnibar.setCursorPosition((e.target as HTMLInputElement).selectionStart ?? 0);
                }}
                onClick={(e) => {
                  omnibar.setCursorPosition((e.target as HTMLInputElement).selectionStart ?? 0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Escribe algo... @entidad //mañana #contexto"
                disabled={omnibar.isSubmitting}
                className="
                  w-full bg-transparent text-base text-foreground
                  placeholder:text-muted-foreground/60
                  focus:outline-none
                  sm:text-lg
                "
              />

              {omnibar.isSubmitting
                ? (
                    <Loader2 className="
                      size-5 shrink-0 animate-spin text-muted-foreground
                    "
                    />
                  )
                : (
                    <kbd className="
                      hidden shrink-0 rounded-md border border-border/60
                      bg-muted/40 px-2 py-0.5 text-xs font-medium
                      text-muted-foreground
                      sm:inline-block
                    "
                    >
                      ↵ Enter
                    </kbd>
                  )}
            </div>

            {/* Menú Desplegable de Autocompletado */}
            {omnibar.suggestions.length > 0 && (
              <div className="border-b border-border/40 px-4 py-2">
                <AutocompleteDropdown
                  suggestions={omnibar.suggestions}
                  selectedIndex={safeSelectedIndex}
                  onSelect={(item) => {
                    omnibar.applySuggestion(item);
                    inputRef.current?.focus();
                  }}
                />
              </div>
            )}

            {/* Huella Molecular Reactiva */}
            <div className="
              px-4 py-2.5
              sm:px-5
            "
            >
              <MolecularFootprint tokens={omnibar.parsedTokens} />
            </div>

            {/* Notificación de Éxito / Error */}
            {omnibar.lastSynthesizedMolecule && (
              <div className="
                flex items-center gap-2 border-t border-emerald-500/20
                bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-600
                dark:text-emerald-400
              "
              >
                <Check className="size-4 shrink-0" />
                <span>
                  Molécula sintetizada con éxito: &ldquo;
                  {String(omnibar.lastSynthesizedMolecule.root.payload.title ?? 'Átomo')}
                  &rdquo; (
                  {omnibar.lastSynthesizedMolecule.outgoing.length + omnibar.lastSynthesizedMolecule.incoming.length}
                  {' '}
                  enlace(s)).
                </span>
              </div>
            )}

            {omnibar.error && (
              <div className="
                flex items-center gap-2 border-t border-destructive/20
                bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive
              "
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{omnibar.error}</span>
              </div>
            )}

            {/* Pie de Ayuda con Atajos */}
            <div className="
              flex flex-wrap items-center justify-between gap-2 border-t
              border-border/40 bg-muted/20 px-4 py-2 text-[11px]
              text-muted-foreground/75
              sm:px-5
            "
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="
                    font-semibold text-purple-600
                    dark:text-purple-400
                  "
                  >
                    @
                  </span>
                  Entidad
                </span>
                <span className="flex items-center gap-1">
                  <span className="
                    font-semibold text-emerald-600
                    dark:text-emerald-400
                  "
                  >
                    &#47;&#47;
                  </span>
                  Fecha
                </span>
                <span className="flex items-center gap-1">
                  <span className="
                    font-semibold text-sky-600
                    dark:text-sky-400
                  "
                  >
                    #
                  </span>
                  Contexto
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span>Esc para salir</span>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
