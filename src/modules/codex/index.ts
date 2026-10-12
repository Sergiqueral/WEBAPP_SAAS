/**
 * Codex Module - Public Interface
 *
 * Módulo autónomo de Arquitectura Molecular de Deuda Técnica Cero.
 * Todas las exportaciones necesarias para integrar Codex en cualquier plantilla o dashboard.
 */

// Database Schema
export * from './db/schema';
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
export { MobileFloatingActionButton as CodexMobileFAB, MobileFloatingActionButton } from './omnibar/ui/MobileFloatingActionButton';
// UI Components
export { OmnibarModal as CodexOmnibarModal } from './omnibar/ui/OmnibarModal';
export { OmnibarTrigger as CodexOmnibarTrigger } from './omnibar/ui/OmnibarTrigger';
export { MolecularFeed as CodexDashboardView } from './views/feed/MolecularFeed';
