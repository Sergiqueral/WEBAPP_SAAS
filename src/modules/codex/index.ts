/**
 * Codex Module - Public Interface
 *
 * Módulo autónomo de Arquitectura Molecular de Deuda Técnica Cero.
 * Todas las exportaciones necesarias para integrar Codex en cualquier plantilla o dashboard.
 */

// UI Components
export { PreferencesModal as CodexPreferencesModal, PreferencesModal } from './components/PreferencesModal';
// Database Schema
export * from './db/schema';
export { calculateCellMetrics } from './domain/cell/cellMetrics';

export type { CellMetrics } from './domain/cell/cellMetrics';

export { useCodexPreferences } from './domain/preferences/useCodexPreferences';

export type { CodexPreferences, OmnibarDisplayMode, ThemeMode } from './domain/preferences/useCodexPreferences';
// Repositories & Engine (para uso en API routes o server actions)
export { AtomRepository } from './domain/repositories/AtomRepository';
export { IdentityRepository } from './domain/repositories/IdentityRepository';
export { MoleculeRepository } from './domain/repositories/MoleculeRepository';
export { SynapseRepository } from './domain/repositories/SynapseRepository';
export { AccessGuard } from './domain/security/AccessGuard';
// Domain Types & Contracts
export * from './domain/types';
export { OmnibarParser } from './omnibar/parser/OmnibarParser';
export { OmnibarReactor } from './omnibar/reactor/OmnibarReactor';
export { InlineOmnibar as CodexInlineOmnibar, InlineOmnibar } from './omnibar/ui/InlineOmnibar';
export { MobileFloatingActionButton as CodexMobileFAB, MobileFloatingActionButton } from './omnibar/ui/MobileFloatingActionButton';
export { OmnibarModal as CodexOmnibarModal } from './omnibar/ui/OmnibarModal';
export { OmnibarTrigger as CodexOmnibarTrigger } from './omnibar/ui/OmnibarTrigger';
export { CellHeader, CellHeader as CodexCellHeader } from './views/cell/CellHeader';
export { MolecularFeed as CodexDashboardView } from './views/feed/MolecularFeed';
