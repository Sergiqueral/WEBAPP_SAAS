'use client';

import type { OmnibarSuggestion } from '@/modules/codex/domain/types';
import { Hash, Plus, User } from 'lucide-react';
import React from 'react';

export type AutocompleteDropdownProps = {
  suggestions: OmnibarSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: OmnibarSuggestion) => void;
  className?: string;
};

export const AutocompleteDropdown: React.FC<AutocompleteDropdownProps> = ({
  className = '',
  onSelect,
  selectedIndex,
  suggestions,
}) => {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      role="listbox"
      aria-label="Sugerencias de la Omnibarra"
      className={`
        max-h-60 overflow-y-auto rounded-xl border border-border/60
        bg-popover/95 p-1.5 shadow-xl backdrop-blur-md
        ${className}
      `}
    >
      {suggestions.map((item, index) => {
        const isSelected = index === selectedIndex;
        const isEntity = item.type === 'entity';

        return (
          <div
            key={item.id}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(item)}
            className={`
              flex cursor-pointer items-center justify-between gap-3 rounded-lg
              px-3 py-2 text-sm transition-colors duration-100
              ${
          isSelected
            ? 'bg-primary/10 font-medium text-primary'
            : `
              text-foreground/90
              hover:bg-muted/60
            `
          }
            `}
          >
            <div className="flex items-center gap-2.5 truncate">
              <span
                className={`
                  flex size-6 shrink-0 items-center justify-center rounded-md
                  ${
          item.isCreateNew
            ? `
              bg-emerald-500/10 text-emerald-600
              dark:text-emerald-400
            `
            : isEntity
              ? `
                bg-purple-500/10 text-purple-600
                dark:text-purple-400
              `
              : `
                bg-sky-500/10 text-sky-600
                dark:text-sky-400
              `
          }
                `}
              >
                {item.isCreateNew
                  ? (
                      <Plus className="size-3.5" />
                    )
                  : isEntity
                    ? (
                        <User className="size-3.5" />
                      )
                    : (
                        <Hash className="size-3.5" />
                      )}
              </span>

              <span className="truncate">
                {item.isCreateNew ? `Crear "${item.label}"` : item.label}
              </span>
            </div>

            {item.subtitle && (
              <span className="shrink-0 text-xs text-muted-foreground/70">
                {item.subtitle}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
