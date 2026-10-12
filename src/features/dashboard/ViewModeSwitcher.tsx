'use client';

import { Calendar, Columns3, List } from 'lucide-react';
import React from 'react';

export type ViewMode = 'list' | 'kanban' | 'calendar';

export type ViewModeSwitcherProps = {
  currentMode: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export const ViewModeSwitcher: React.FC<ViewModeSwitcherProps> = ({
  currentMode,
  onChange,
}) => {
  return (
    <div
      role="group"
      aria-label="Selector de vista"
      className="
        inline-flex items-center rounded-xl border border-border bg-muted/60 p-1
      "
    >
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={currentMode === 'list'}
        className={`
          inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs
          font-medium transition-all
          ${
    currentMode === 'list'
      ? 'bg-background text-foreground shadow-xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
        `}
      >
        <List className="size-3.5" />
        <span className="
          hidden
          sm:inline
        "
        >
          Lista
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChange('kanban')}
        aria-pressed={currentMode === 'kanban'}
        className={`
          inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs
          font-medium transition-all
          ${
    currentMode === 'kanban'
      ? 'bg-background text-foreground shadow-xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
        `}
      >
        <Columns3 className="size-3.5" />
        <span className="
          hidden
          sm:inline
        "
        >
          Kanban
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChange('calendar')}
        aria-pressed={currentMode === 'calendar'}
        className={`
          inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs
          font-medium transition-all
          ${
    currentMode === 'calendar'
      ? 'bg-background text-foreground shadow-xs'
      : `
        text-muted-foreground
        hover:text-foreground
      `
    }
        `}
      >
        <Calendar className="size-3.5" />
        <span className="
          hidden
          sm:inline
        "
        >
          Calendario
        </span>
      </button>
    </div>
  );
};
