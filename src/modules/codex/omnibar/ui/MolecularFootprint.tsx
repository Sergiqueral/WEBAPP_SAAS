'use client';

import type { ParsedTokens } from '@/modules/codex/domain/types';
import { Calendar, CheckCircle2, FileText, Hash, Inbox, User } from 'lucide-react';
import React from 'react';

export type MolecularFootprintProps = {
  tokens: ParsedTokens;
  className?: string;
};

export const MolecularFootprint: React.FC<MolecularFootprintProps> = ({
  tokens,
  className = '',
}) => {
  const { cleanText, contexts, entities, temporal } = tokens;

  // Determinar la naturaleza del átomo central
  const hasTokens = entities.length > 0 || contexts.length > 0 || !!temporal;
  const atomType = hasTokens ? (temporal ? 'task' : 'note') : 'inbox';

  const atomTypeConfig = {
    task: {
      label: 'Tarea',
      icon: CheckCircle2,
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    },
    note: {
      label: 'Nota',
      icon: FileText,
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
    inbox: {
      label: 'Inbox Neutro',
      icon: Inbox,
      color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    },
  }[atomType];

  const AtomIcon = atomTypeConfig.icon;

  return (
    <div className={`
      flex flex-col gap-2 border-t border-border/40 pt-2 text-xs
      ${className}
    `}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Huella del Átomo Central */}
        <span
          className={`
            inline-flex items-center gap-1 rounded-full border px-2 py-0.5
            font-medium
            ${atomTypeConfig.color}
            transition-all duration-150
          `}
        >
          <AtomIcon className="size-3" />
          <span>{atomTypeConfig.label}</span>
        </span>

        {/* Huella de Entidades (@) */}
        {entities.map(ent => (
          <span
            key={`ent-${ent.startIndex}-${ent.name}`}
            className="
              inline-flex items-center gap-1 rounded-full border
              border-purple-500/25 bg-purple-500/10 px-2 py-0.5 font-medium
              text-purple-600 transition-all duration-150
              dark:text-purple-400
            "
          >
            <User className="size-3" />
            <span>
              @
              {ent.name}
            </span>
          </span>
        ))}

        {/* Huella Temporal (//) */}
        {temporal && (
          <span className="
            inline-flex items-center gap-1 rounded-full border
            border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-medium
            text-emerald-600 transition-all duration-150
            dark:text-emerald-400
          "
          >
            <Calendar className="size-3" />
            <span>
              {temporal.expression}
              {temporal.hasTime ? ` (${temporal.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
            </span>
          </span>
        )}

        {/* Huella de Contextos (#) */}
        {contexts.map(ctx => (
          <span
            key={`ctx-${ctx.startIndex}-${ctx.name}`}
            className="
              inline-flex items-center gap-1 rounded-full border
              border-sky-500/25 bg-sky-500/10 px-2 py-0.5 font-medium
              text-sky-600 transition-all duration-150
              dark:text-sky-400
            "
          >
            <Hash className="size-3" />
            <span>
              #
              {ctx.name}
            </span>
          </span>
        ))}
      </div>

      {/* Previsualización del Título Limpio */}
      {cleanText.trim().length > 0 && (
        <div className="truncate text-muted-foreground/80">
          <span className="font-semibold text-foreground/70">Título: </span>
          &ldquo;
          {cleanText.trim()}
          &rdquo;
        </div>
      )}
    </div>
  );
};
