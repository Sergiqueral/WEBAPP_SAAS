import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// ==========================================
// MÓDULO LICENSING: ESQUEMA DE BASE DE DATOS
// Cero invasión de la plantilla - Alta escalabilidad
// ==========================================

export const tenantSubscriptionsSchema = pgTable('tenant_subscriptions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull(),
  plan: text('plan').notNull().default('alpha_tester'), // 'alpha_tester' | 'free' | 'pro' | 'enterprise'
  status: text('status').notNull().default('active'), // 'active' | 'dormant' | 'archived' | 'scheduled_for_deletion'
  isProtected: boolean('is_protected').notNull().default(false), // Protección manual del superadmin contra limpieza
  lastActiveAt: timestamp('last_active_at', { mode: 'date' })
    .defaultNow()
    .notNull(),
  firstGuestTrialStartedAt: timestamp('first_guest_trial_started_at', { mode: 'date' }),
  firstGuestTrialEndsAt: timestamp('first_guest_trial_ends_at', { mode: 'date' }),
  paidSeatsCount: integer('paid_seats_count').notNull().default(0),
  metadata: jsonb('metadata').notNull().$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('tenant_subs_org_idx').on(table.organizationId),
  index('tenant_subs_status_idx').on(table.status),
  index('tenant_subs_last_active_idx').on(table.lastActiveAt),
]);

export const tenantAddonsSchema = pgTable('tenant_addons', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull(),
  addonKey: text('addon_key').notNull(), // 'stel_order' | 'google_sync_write'
  status: text('status').notNull().default('active'), // 'active' | 'paused' | 'canceled'
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('tenant_addons_org_key_idx').on(table.organizationId, table.addonKey),
  index('tenant_addons_org_idx').on(table.organizationId),
]);

export const tenantFeatureOverridesSchema = pgTable('tenant_feature_overrides', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull(),
  featureKey: text('feature_key').notNull(),
  isGranted: boolean('is_granted').notNull(),
  reason: text('reason'),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('tenant_overrides_org_feature_idx').on(table.organizationId, table.featureKey),
  index('tenant_overrides_org_idx').on(table.organizationId),
]);
