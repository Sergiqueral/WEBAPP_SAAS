// ==========================================
// MÓDULO LICENSING: BARRIL DE EXPORTACIÓN PÚBLICA
// ==========================================

export * from './components/FeatureGate';
export * from './components/UpgradeModal';
export * from './db/schema';
export * from './domain/EntitlementEngine';
export * from './domain/plans';
export * from './domain/types';
export * from './hooks/useFeatureGate';
export * from './server/activityTracker';
export * from './server/assertEntitlement';
export * from './server/licensingRepository';
export * from './server/orgCreationGuard';
export * from './tasks/cleanupZombies';
