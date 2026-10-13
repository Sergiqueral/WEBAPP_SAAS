'use client';

import type { ParsedTokens } from '@/modules/codex/domain/types';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Hash,
  HelpCircle,
  Inbox,
  Mail,
  MapPin,
  Phone,
  User,
  UserCheck,
  Zap,
} from 'lucide-react';
import React from 'react';

export type MolecularFootprintProps = {
  tokens: ParsedTokens;
  className?: string;
};

export const MolecularFootprint: React.FC<MolecularFootprintProps> = ({
  tokens,
  className = '',
}) => {
  const {
    actions = [],
    cleanText,
    conditions = [],
    contexts = [],
    documents = [],
    emails = [],
    entities = [],
    locations = [],
    phones = [],
    temporal,
  } = tokens;

  // Determinar la naturaleza del átomo central (Arquetipo)
  const isOperative = actions.length > 0 || !!temporal;
  const hasContactAnchor = phones.length > 0 || emails.length > 0 || documents.length > 0;
  const hasEntity = entities.length > 0;
  const hasContext = contexts.length > 0;
  const hasLocation = locations.length > 0;

  let atomType: 'task' | 'client' | 'note' | 'inbox' = 'inbox';
  if (isOperative) {
    atomType = 'task';
  } else if (hasContactAnchor && hasEntity) {
    atomType = 'client';
  } else if (hasEntity || hasContext || hasLocation) {
    atomType = 'note';
  }

  const atomTypeConfig = {
    task: {
      label: 'Tarea Operativa',
      icon: CheckCircle2,
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    },
    client: {
      label: 'Ficha Cliente',
      icon: UserCheck,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
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
    <div
      className={`
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

        {/* Huella de Acciones Operativas (⚡) */}
        {actions.map(act => (
          <span
            key={`act-${act.startIndex}-${act.raw}`}
            className="
              inline-flex items-center gap-1 rounded-full border
              border-orange-500/25 bg-orange-500/10 px-2 py-0.5 font-medium
              text-orange-600 transition-all duration-150
              dark:text-orange-400
            "
          >
            <Zap className="size-3" />
            <span>{act.label}</span>
          </span>
        ))}

        {/* Huella de Entidades (@ o Nombres) */}
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
              {ent.raw.startsWith('@') ? '' : '@'}
              {ent.name}
            </span>
          </span>
        ))}

        {/* Huella Telefónica (📞) */}
        {phones.map(p => (
          <span
            key={`phone-${p.startIndex}-${p.number}`}
            className="
              inline-flex items-center gap-1 rounded-full border
              border-teal-500/25 bg-teal-500/10 px-2 py-0.5 font-medium
              text-teal-600 transition-all duration-150
              dark:text-teal-400
            "
          >
            <Phone className="size-3" />
            <span>{p.raw}</span>
          </span>
        ))}

        {/* Huella de Correo (✉️) */}
        {emails.map(e => (
          <span
            key={`email-${e.startIndex}-${e.email}`}
            className="
              inline-flex items-center gap-1 rounded-full border
              border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 font-medium
              text-cyan-600 transition-all duration-150
              dark:text-cyan-400
            "
          >
            <Mail className="size-3" />
            <span>{e.email}</span>
          </span>
        ))}

        {/* Huella de Documento Fiscal (🪪 DNI/NIE/CIF) */}
        {documents.map(doc => (
          <span
            key={`doc-${doc.startIndex}-${doc.documentNumber}`}
            className={`
              inline-flex items-center gap-1 rounded-full border px-2 py-0.5
              font-medium transition-all duration-150
              ${
          doc.isValid
            ? `
              border-violet-500/25 bg-violet-500/10 text-violet-600
              dark:text-violet-400
            `
            : `
              border-amber-500/25 bg-amber-500/10 text-amber-600
              dark:text-amber-400
            `
          }
            `}
          >
            {doc.isValid
              ? <CreditCard className="size-3" />
              : (
                  <AlertCircle className="size-3" />
                )}
            <span>
              {doc.type.toUpperCase()}
              :
              {doc.documentNumber}
              {!doc.isValid ? ' (!)' : ''}
            </span>
          </span>
        ))}

        {/* Huella de Ubicación Geográfica (📍 GPS / Plus Code / Dirección) */}
        {locations.map(loc => (
          <span
            key={`loc-${loc.startIndex}-${loc.normalized}`}
            className="
              inline-flex items-center gap-1 rounded-full border
              border-rose-500/25 bg-rose-500/10 px-2 py-0.5 font-medium
              text-rose-600 transition-all duration-150
              dark:text-rose-400
            "
          >
            <MapPin className="size-3" />
            <span>
              {loc.type === 'coordinates'
                ? `GPS: ${loc.normalized}`
                : loc.type === 'plus_code'
                  ? `PlusCode: ${loc.normalized}`
                  : loc.normalized}
            </span>
          </span>
        ))}

        {/* Huella Temporal (// o Natural) */}
        {temporal && (
          <span
            className="
              inline-flex items-center gap-1 rounded-full border
              border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-medium
              text-emerald-600 transition-all duration-150
              dark:text-emerald-400
            "
          >
            <Calendar className="size-3" />
            <span>
              {temporal.expression}
              {temporal.hasTime
                ? ` (${temporal.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                : ''}
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

        {/* Huella de Condición / Incertidumbre (🟡) */}
        {conditions.map(c => (
          <span
            key={`cond-${c.startIndex}-${c.expression}`}
            className="
              inline-flex items-center gap-1 rounded-full border
              border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-medium
              text-amber-600 transition-all duration-150
              dark:text-amber-400
            "
          >
            <HelpCircle className="size-3" />
            <span>{c.expression}</span>
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
