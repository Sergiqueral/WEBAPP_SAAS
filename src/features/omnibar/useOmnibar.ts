'use client';

import type { MolecularProjection } from '@/types/biology';
import type { OmnibarSuggestion, ParsedTokens } from '@/types/omnibar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OmnibarParser } from '@/libs/omnibar/OmnibarParser';

export type UseOmnibarOptions = {
  knownEntities?: Array<{ id: string; name: string }>;
  knownContexts?: Array<{ id: string; name: string }>;
  onSuccess?: (molecule: MolecularProjection) => void;
  onError?: (error: Error) => void;
};

export function useOmnibar(options: UseOmnibarOptions = {}) {
  const { knownContexts = [], knownEntities = [], onError, onSuccess } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynthesizedMolecule, setLastSynthesizedMolecule] = useState<MolecularProjection | null>(null);

  // Parseo determinista en tiempo real de los tokens conforme el usuario escribe
  const parsedTokens: ParsedTokens = useMemo(() => {
    return OmnibarParser.extractTokens(rawText, { knownEntities });
  }, [rawText, knownEntities]);

  // Detección del contexto activo para el autocompletado (@ o #)
  const activeTrigger = useMemo(() => {
    if (!isOpen) {
      return null;
    }

    const textBeforeCursor = rawText.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

    const maxTriggerIndex = Math.max(lastAtIndex, lastHashIndex);
    if (maxTriggerIndex === -1) {
      return null;
    }

    const triggerChar = textBeforeCursor[maxTriggerIndex];
    const query = textBeforeCursor.slice(maxTriggerIndex + 1);

    // Si hay un espacio o salto de línea después del trigger, la sugerencia se cierra
    if (/[\s,.]/.test(query)) {
      return null;
    }

    return {
      type: triggerChar === '@' ? ('entity' as const) : ('context' as const),
      query,
      startIndex: maxTriggerIndex,
    };
  }, [rawText, cursorPosition, isOpen]);

  // Lista de sugerencias computadas para el autocompletado
  const suggestions: OmnibarSuggestion[] = useMemo(() => {
    if (!activeTrigger) {
      return [];
    }

    const { query, type } = activeTrigger;
    const lowerQuery = query.toLowerCase().trim();

    if (type === 'entity') {
      const matches: OmnibarSuggestion[] = knownEntities
        .filter(e => e.name.toLowerCase().includes(lowerQuery))
        .map(e => ({
          id: e.id,
          label: e.name,
          type: 'entity',
          subtitle: 'Entidad existente',
        }));

      if (query.trim().length > 0 && !matches.some(m => m.label.toLowerCase() === lowerQuery)) {
        matches.push({
          id: `create-entity-${query}`,
          label: query.trim(),
          type: 'entity',
          subtitle: 'Crear nueva entidad',
          isCreateNew: true,
        });
      }

      return matches;
    }

    const matches: OmnibarSuggestion[] = knownContexts
      .filter(c => c.name.toLowerCase().includes(lowerQuery))
      .map(c => ({
        id: c.id,
        label: c.name,
        type: 'context',
        subtitle: 'Contexto existente',
      }));

    if (query.trim().length > 0 && !matches.some(m => m.label.toLowerCase() === lowerQuery)) {
      matches.push({
        id: `create-context-${query}`,
        label: query.trim(),
        type: 'context',
        subtitle: 'Crear nuevo contexto',
        isCreateNew: true,
      });
    }

    return matches;
  }, [activeTrigger, knownEntities, knownContexts]);

  // Inserción de una sugerencia seleccionada en el texto
  const applySuggestion = useCallback(
    (suggestion: OmnibarSuggestion) => {
      if (!activeTrigger) {
        return;
      }

      const prefix = activeTrigger.type === 'entity' ? '@' : '#';
      const replacement = `${prefix}${suggestion.label} `;

      const before = rawText.slice(0, activeTrigger.startIndex);
      const after = rawText.slice(cursorPosition);

      const newText = `${before}${replacement}${after}`;
      const newCursor = before.length + replacement.length;

      setRawText(newText);
      setCursorPosition(newCursor);
    },
    [activeTrigger, rawText, cursorPosition],
  );

  // Envío al reactor molecular de ingesta
  const submit = useCallback(async () => {
    const trimmed = rawText.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Error al procesar la ingesta');
      }

      const molecule: MolecularProjection = data.molecule;
      setLastSynthesizedMolecule(molecule);
      setRawText('');
      onSuccess?.(molecule);
    } catch (err) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj.message);
      onError?.(errObj);
    } finally {
      setIsSubmitting(false);
    }
  }, [rawText, isSubmitting, onSuccess, onError]);

  // Atajo de teclado global (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    setIsOpen,
    rawText,
    setRawText,
    cursorPosition,
    setCursorPosition,
    parsedTokens,
    activeTrigger,
    suggestions,
    applySuggestion,
    submit,
    isSubmitting,
    error,
    setError,
    lastSynthesizedMolecule,
    reset: () => {
      setRawText('');
      setError(null);
      setLastSynthesizedMolecule(null);
    },
  };
}
