'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useCodexPreferences } from '@/modules/codex/domain/preferences/useCodexPreferences';

export const ThemeToggle: React.FC = () => {
  const { setTheme, theme } = useCodexPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="
          flex size-8 items-center justify-center rounded-lg border
          border-border bg-background text-foreground transition-colors
          hover:bg-muted hover:text-foreground
        "
        aria-label="Cambiar tema de la aplicación"
      >
        {theme === 'dark'
          ? (
              <Moon className="size-4" />
            )
          : theme === 'light'
            ? (
                <Sun className="size-4" />
              )
            : (
                <Laptop className="size-4" />
              )}
      </button>

      {isOpen && (
        <div className="
          absolute right-0 z-50 mt-2 w-36 rounded-xl border border-border
          bg-popover p-1 text-popover-foreground shadow-lg backdrop-blur-md
        "
        >
          <button
            type="button"
            onClick={() => {
              setTheme('light');
              setIsOpen(false);
            }}
            className={`
              flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs
              transition-colors
              ${theme === 'light'
          ? `bg-accent font-semibold text-accent-foreground`
          : `
            text-muted-foreground
            hover:bg-muted hover:text-foreground
          `}
            `}
          >
            <Sun className="size-3.5" />
            <span>Claro</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              setIsOpen(false);
            }}
            className={`
              flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs
              transition-colors
              ${theme === 'dark'
          ? `bg-accent font-semibold text-accent-foreground`
          : `
            text-muted-foreground
            hover:bg-muted hover:text-foreground
          `}
            `}
          >
            <Moon className="size-3.5" />
            <span>Oscuro</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('system');
              setIsOpen(false);
            }}
            className={`
              flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs
              transition-colors
              ${theme === 'system'
          ? `bg-accent font-semibold text-accent-foreground`
          : `
            text-muted-foreground
            hover:bg-muted hover:text-foreground
          `}
            `}
          >
            <Laptop className="size-3.5" />
            <span>Sistema</span>
          </button>
        </div>
      )}
    </div>
  );
};
