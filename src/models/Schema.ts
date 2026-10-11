import { index, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// It automatically run the command `db-server:file`, which apply the migration before Next.js starts in development mode,
// Alternatively, if your database is running, you can run `npm run db:migrate` and there is no need to restart the server.

// Need a database for production? Check out https://get.neon.com/BMFYNtx
// Tested and compatible with SaaS Boilerplate

export const todoSchema = pgTable('todo', {
  id: serial('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// ==========================================
// PROYECTO GORILA CODEX: BIOLOGÍA DEL DATO
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
  type: text('type').notNull(), // Dinámico: 'task', 'client', 'contact', 'note', 'event', 'lead', etc.
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
  relationType: text('relation_type').notNull(), // Dinámico: 'ASSIGNED_TO', 'PARENT_OF', 'TAGGED_WITH', 'SHARED_WITH', etc.
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
