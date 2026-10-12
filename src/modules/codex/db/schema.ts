import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// ==========================================
// MÓDULO GORILA CODEX: BIOLOGÍA DEL DATO
// Esquema Drizzle autocontenido y de alto rendimiento
// ==========================================

export const membershipsSchema = pgTable('memberships', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('member'), // 'owner' | 'admin' | 'member' | 'viewer' | 'guest'
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('memberships_org_user_idx').on(table.organizationId, table.userId),
  index('memberships_org_role_idx').on(table.organizationId, table.role),
]);

export const atomsSchema = pgTable('atoms', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull(),
  type: text('type').notNull(), // 'task', 'client', 'contact', 'note', 'event', 'lead', etc.
  payload: jsonb('payload').notNull().$type<Record<string, unknown>>().default({}),
  metadata: jsonb('metadata').notNull().$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [
  index('atoms_org_type_idx').on(table.organizationId, table.type),
  index('atoms_org_created_idx').on(table.organizationId, table.createdAt),
  // Índices de alto rendimiento para escalabilidad a millones de partículas (Paso 4):
  // 1. Evita Sort en memoria en feed, kanban y calendarios cuando se filtra por tipo
  index('atoms_org_type_created_idx').on(table.organizationId, table.type, table.createdAt.desc()),
  // 2. Ordenación rápida por átomos recientemente modificados
  index('atoms_org_updated_idx').on(table.organizationId, table.updatedAt.desc()),
  // 3. Índice GIN sobre payload para búsquedas y filtros en atributos dinámicos
  index('atoms_payload_gin_idx').using('gin', table.payload),
]);

export const linksSchema = pgTable('links', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull(),
  sourceAtomId: text('source_atom_id')
    .notNull()
    .references(() => atomsSchema.id, { onDelete: 'cascade' }),
  targetAtomId: text('target_atom_id')
    .notNull()
    .references(() => atomsSchema.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull(), // 'ASSIGNED_TO', 'PARENT_OF', 'TAGGED_WITH', 'SHARED_WITH', etc.
  metadata: jsonb('metadata').notNull().$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [
  index('links_org_source_idx').on(table.organizationId, table.sourceAtomId),
  index('links_org_target_idx').on(table.organizationId, table.targetAtomId),
  uniqueIndex('links_unique_synapse_idx').on(
    table.organizationId,
    table.sourceAtomId,
    table.targetAtomId,
    table.relationType,
  ),
  // Índices de alto rendimiento para el grafo de sinapsis (Paso 4):
  // 1. Acelera CASCADE en eliminaciones y navegación directa por ID de átomo
  index('links_source_atom_idx').on(table.sourceAtomId),
  index('links_target_atom_idx').on(table.targetAtomId),
  // 2. Filtrado rápido por tipo de relación (ej. ASSIGNED_TO, TAGGED_WITH)
  index('links_org_relation_idx').on(table.organizationId, table.relationType),
  // 3. Auditoría cronológica de sinapsis
  index('links_org_created_idx').on(table.organizationId, table.createdAt.desc()),
]);

export const atomExternalIdentitiesSchema = pgTable('atom_external_identities', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull(),
  atomId: text('atom_id')
    .notNull()
    .references(() => atomsSchema.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'google_contacts', 'google_calendar', 'stel_order', etc.
  externalId: text('external_id').notNull(),
  syncHash: text('sync_hash'),
  lastSyncedAt: timestamp('last_synced_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('external_id_unique_idx').on(table.organizationId, table.provider, table.externalId),
  index('external_atom_idx').on(table.organizationId, table.atomId),
]);
