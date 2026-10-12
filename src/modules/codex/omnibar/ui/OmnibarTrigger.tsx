'use client';

import { Sparkles } from 'lucide-react';
import React from 'react';

export type OmnibarTriggerProps = {
  className?: string;
  label?: string;
};

export const OmnibarTrigger: React.FC<OmnibarTriggerProps> = ({
  className = '',
  label = 'Captura rápida...',
}) => {
  const handleClick = () => {
    // Dispara el atajo global de teclado para abrir la Omnibarra
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
      aria-label="Abrir Omnibarra mecánica (Cmd+K)"
      className={`
        group flex items-center gap-2 rounded-xl border border-border/60
        bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-all
        duration-150
        hover:border-primary/40 hover:bg-muted/60 hover:text-foreground
        ${className}
      `}
    >
      <Sparkles className="
        size-3.5 text-primary transition-transform duration-200
        group-hover:scale-110
      "
      />
      <span className="
        hidden
        sm:inline
      "
      >
        {label}
      </span>
      <kbd className="
        rounded-sm border border-border/60 bg-background/80 px-1.5 py-0.5
        text-[10px] font-medium text-muted-foreground/80 shadow-2xs
      "
      >
        ⌘K
      </kbd>
    </button>
  );
};
