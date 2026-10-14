'use client';

import type { MolecularProjection } from '@/modules/codex/domain/types';
import {
  Calendar,
  CheckCircle2,
  CornerDownLeft,
  CreditCard,
  Hash,
  Loader2,
  MapPin,
  Maximize2,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useOmnibar } from '../hooks/useOmnibar';
import { AutocompleteDropdown } from './AutocompleteDropdown';

export type InlineOmnibarProps = {
  className?: string;
  onSuccess?: (molecule: MolecularProjection) => void;
};

export const InlineOmnibar: React.FC<InlineOmnibarProps> = ({
  className = '',
  onSuccess,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const omnibar = useOmnibar({
    alwaysActive: true,
    onSuccess: (mol) => {
      setSuccessNotice('¡Partícula sintetizada y guardada!');
      setTimeout(setSuccessNotice, 2500, null);
      onSuccess?.(mol);
    },
  });

  const safeSelectedIndex = omnibar.suggestions.length > 0
    ? Math.min(selectedIndex, omnibar.suggestions.length - 1)
    : 0;

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
          setSelectedIndex(0);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        omnibar.setRawText(prev => prev.trimEnd());
        return;
      }
    }

    if (e.key === 'Enter' && !hasSuggestions) {
      e.preventDefault();
      void omnibar.submit();
    }
  };

  // Botones de inserción interactiva de sintaxis
  const insertPrefix = (prefix: string) => {
    const current = omnibar.rawText;
    let newText = current;

    if (prefix === '// ') {
      if (!current.startsWith('//')) {
        newText = `// ${current}`.trimStart();
      }
    } else {
      newText = current ? `${current.trimEnd()} ${prefix}` : prefix;
    }

    omnibar.setRawText(newText);
    omnibar.setCursorPosition(newText.length);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(newText.length, newText.length);
    }, 10);
  };

  // Abrir modal expandido
  const openModal = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      }),
    );
  };

  const isTask = omnibar.rawText.trimStart().startsWith('//');
  const isEvent = useMemo(() => {
    return (
      omnibar.parsedTokens.chunks.some(c => c.type === 'event')
      || omnibar.parsedTokens.actions.some(a => a.action === 'visit')
    );
  }, [omnibar.parsedTokens.chunks, omnibar.parsedTokens.actions]);

  const eventTimeLabel = useMemo(() => {
    if (!omnibar.parsedTokens.temporal) {
      return null;
    }
    const { expression, hasTime } = omnibar.parsedTokens.temporal;
    const capitalized = expression.charAt(0).toUpperCase() + expression.slice(1);
    if (isEvent && !hasTime) {
      return `${capitalized} a las 09:00`;
    }
    return capitalized;
  }, [omnibar.parsedTokens.temporal, isEvent]);

  const hasTokens
    = isTask
      || omnibar.parsedTokens.entities.length > 0
      || omnibar.parsedTokens.contexts.length > 0
      || omnibar.parsedTokens.phones.length > 0
      || omnibar.parsedTokens.locations.length > 0
      || omnibar.parsedTokens.documents.length > 0
      || !!omnibar.parsedTokens.temporal;

  return (
    <div
      className={`
        relative rounded-2xl border border-border/80 bg-card/95 p-3 shadow-xs
        backdrop-blur-md transition-all duration-200
        focus-within:border-primary/50 focus-within:ring-2
        focus-within:ring-primary/20
        ${className}
      `}
    >
      {/* Fila principal del input */}
      <div className="flex items-center gap-2.5">
        <div className="
          flex size-8 shrink-0 items-center justify-center rounded-xl
          bg-primary/10 text-primary
        "
        >
          <Sparkles className="size-4 animate-pulse" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={omnibar.rawText}
          onChange={(e) => {
            omnibar.setRawText(e.target.value);
            omnibar.setCursorPosition(e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={handleKeyDown}
          onClick={e => omnibar.setCursorPosition(e.currentTarget.selectionStart ?? 0)}
          onKeyUp={e => omnibar.setCursorPosition(e.currentTarget.selectionStart ?? 0)}
          placeholder="// Escribe una tarea, @ persona o # proyecto... (pulsa Enter)"
          className="
            flex-1 bg-transparent text-sm text-foreground outline-none
            placeholder:text-muted-foreground/60
          "
        />

        {/* Botón de envío directo */}
        <button
          type="button"
          onClick={() => void omnibar.submit()}
          disabled={!omnibar.rawText.trim() || omnibar.isSubmitting}
          aria-label="Crear partícula"
          className="
            inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3
            py-1.5 text-xs font-medium text-primary-foreground shadow-2xs
            transition-all duration-150
            hover:opacity-90
            disabled:cursor-not-allowed disabled:opacity-40
          "
        >
          {omnibar.isSubmitting
            ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              )
            : (
                <>
                  <span>Crear</span>
                  <CornerDownLeft className="size-3.5 opacity-80" />
                </>
              )}
        </button>
      </div>

      {/* Fila inferior: Píldoras de ayuda rápida interactiva */}
      <div className="
        mt-2.5 flex flex-wrap items-center justify-between gap-1.5 border-t
        border-border/40 pt-2
      "
      >
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="
            mr-1 hidden text-[11px] font-medium text-muted-foreground/70
            sm:inline
          "
          >
            Insertar:
          </span>

          <button
            type="button"
            onClick={() => insertPrefix('// ')}
            className="
              inline-flex items-center gap-1 rounded-lg border border-border/60
              bg-muted/30 px-2 py-0.5 text-[11px] font-medium
              text-muted-foreground transition-colors
              hover:border-primary/40 hover:bg-muted/70 hover:text-foreground
            "
          >
            <CheckCircle2 className="size-3 text-emerald-500" />
            <span>Tarea</span>
          </button>

          <button
            type="button"
            onClick={() => insertPrefix('@')}
            className="
              inline-flex items-center gap-1 rounded-lg border border-border/60
              bg-muted/30 px-2 py-0.5 text-[11px] font-medium
              text-muted-foreground transition-colors
              hover:border-primary/40 hover:bg-muted/70 hover:text-foreground
            "
          >
            <User className="size-3 text-sky-500" />
            <span>@ Asignar</span>
          </button>

          <button
            type="button"
            onClick={() => insertPrefix('#')}
            className="
              inline-flex items-center gap-1 rounded-lg border border-border/60
              bg-muted/30 px-2 py-0.5 text-[11px] font-medium
              text-muted-foreground transition-colors
              hover:border-primary/40 hover:bg-muted/70 hover:text-foreground
            "
          >
            <Hash className="size-3 text-purple-500" />
            <span># Proyecto</span>
          </button>
        </div>

        {/* Atajo al modal expandido */}
        <button
          type="button"
          onClick={openModal}
          title="Abrir reactor expandido con vista previa de grafo"
          className="
            inline-flex items-center gap-1 text-[11px] text-muted-foreground/70
            transition-colors
            hover:text-foreground
          "
        >
          <Maximize2 className="size-3" />
          <span className="
            hidden
            sm:inline
          "
          >
            Modo extendido
          </span>
          <kbd className="rounded-sm bg-muted px-1 text-[9px] font-medium">⌘K</kbd>
        </button>
      </div>

      {/* Resaltado dinámico de tokens detectados en tiempo real */}
      {hasTokens && (
        <div className="
          mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/30
          pt-1.5
        "
        >
          <span className="
            text-[10px] font-semibold tracking-wider text-muted-foreground/60
            uppercase
          "
          >
            Detectado:
          </span>

          {isTask && (
            <span className="
              inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5
              py-0.5 text-[10px] font-medium text-emerald-600
              dark:text-emerald-400
            "
            >
              <CheckCircle2 className="size-2.5" />
              Tarea
            </span>
          )}

          {omnibar.parsedTokens.entities.map(e => (
            <span
              key={e.name}
              className="
                inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5
                py-0.5 text-[10px] font-medium text-sky-600
                dark:text-sky-400
              "
            >
              <User className="size-2.5" />
              {e.raw.startsWith('@') ? `@${e.name}` : `Cliente: ${e.name}`}
            </span>
          ))}

          {omnibar.parsedTokens.phones.map(p => (
            <span
              key={p.number}
              className="
                inline-flex items-center gap-1 rounded-md bg-emerald-500/10
                px-1.5 py-0.5 text-[10px] font-medium text-emerald-600
                dark:text-emerald-400
              "
            >
              <Phone className="size-2.5" />
              Teléfono:
              {' '}
              {p.raw || p.number}
            </span>
          ))}

          {omnibar.parsedTokens.locations.map(loc => (
            <span
              key={`loc-${loc.startIndex}-${loc.raw}`}
              className="
                inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5
                py-0.5 text-[10px] font-medium text-amber-600
                dark:text-amber-400
              "
            >
              <MapPin className="size-2.5" />
              Ubicación:
              {' '}
              {loc.normalized || loc.raw}
            </span>
          ))}

          {omnibar.parsedTokens.documents.map(d => (
            <span
              key={d.documentNumber}
              className="
                inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5
                py-0.5 text-[10px] font-medium text-rose-600
                dark:text-rose-400
              "
            >
              <CreditCard className="size-2.5" />
              {d.type.toUpperCase()}
              :
              {d.documentNumber}
            </span>
          ))}

          {omnibar.parsedTokens.temporal && (
            <span
              className="
                inline-flex items-center gap-1 rounded-md bg-indigo-500/10
                px-1.5 py-0.5 text-[10px] font-medium text-indigo-600
                dark:text-indigo-400
              "
            >
              <Calendar className="size-2.5" />
              {isEvent ? `Evento: ${eventTimeLabel}` : `Fecha: ${eventTimeLabel}`}
            </span>
          )}

          {omnibar.parsedTokens.contexts.map(c => (
            <span
              key={c.name}
              className="
                inline-flex items-center gap-1 rounded-md bg-purple-500/10
                px-1.5 py-0.5 text-[10px] font-medium text-purple-600
                dark:text-purple-400
              "
            >
              <Hash className="size-2.5" />
              #
              {c.name}
            </span>
          ))}
        </div>
      )}

      {/* Aviso de éxito efímero */}
      {successNotice && (
        <div className="
          mt-2 flex animate-in items-center gap-1.5 text-xs font-medium
          text-emerald-600 fade-in
          dark:text-emerald-400
        "
        >
          <CheckCircle2 className="size-3.5" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Aviso de error */}
      {omnibar.error && (
        <div className="
          mt-2 animate-in text-xs font-medium text-destructive fade-in
        "
        >
          {omnibar.error}
        </div>
      )}

      {/* Desplegable de autocompletado (@ o #) */}
      {omnibar.suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-40 mt-1.5 w-full">
          <AutocompleteDropdown
            suggestions={omnibar.suggestions}
            selectedIndex={safeSelectedIndex}
            onSelect={(suggestion) => {
              omnibar.applySuggestion(suggestion);
              setSelectedIndex(0);
              inputRef.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
};
