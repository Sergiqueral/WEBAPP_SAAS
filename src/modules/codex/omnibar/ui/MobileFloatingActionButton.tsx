'use client';

import { Plus, Sparkles } from 'lucide-react';
import React from 'react';

export type MobileFloatingActionButtonProps = {
  className?: string;
  onClick?: () => void;
};

/**
 * MobileFloatingActionButton (FAB)
 *
 * Botón flotante accesible de acción para teléfonos y tablets.
 * Cumple con directrices WCAG (área táctil >= 48px, contraste accesible y safe-area-insets).
 * Dispara el atajo global ⌘K para invocar la Omnibarra biológica desde cualquier
 * punto de la pantalla táctil sin necesidad de scroll hacia la cabecera.
 */
export const MobileFloatingActionButton: React.FC<MobileFloatingActionButtonProps> = ({
  className = '',
  onClick,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    // Dispara el evento global para abrir la Omnibarra (Cmd+K / Ctrl+K)
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      }),
    );
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Capturar átomo o tarea con la Omnibarra"
      title="Captura rápida (Omnibarra)"
      className={`
        fixed z-40 flex size-14 items-center justify-center rounded-full
        bg-primary text-primary-foreground shadow-lg shadow-primary/30
        transition-all duration-200 ease-out
        hover:scale-105 hover:bg-primary/95 hover:shadow-xl
        hover:shadow-primary/40
        focus-visible:ring-2 focus-visible:ring-ring
        focus-visible:outline-hidden
        active:scale-95
        md:hidden
        ${className}
      `}
      style={{
        bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
        right: 'calc(1.25rem + env(safe-area-inset-right, 0px))',
      }}
    >
      <Plus className="
        size-6 transition-transform duration-200
        group-hover:rotate-90
      "
      />
      <span
        aria-hidden="true"
        className="
          absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center
          rounded-full border-2 border-background bg-amber-400 text-stone-900
          shadow-2xs
        "
      >
        <Sparkles className="size-2.5" />
      </span>
      <span className="sr-only">Capturar átomo o tarea con la Omnibarra</span>
    </button>
  );
};
