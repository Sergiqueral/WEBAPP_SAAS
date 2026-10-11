import { z } from 'zod';

// ==========================================
// ROLES Y SEGURIDAD MULTI-TENANT
// ==========================================

export const RoleSchema = z.enum(['owner', 'admin', 'member', 'viewer', 'guest']);
export type Role = z.infer<typeof RoleSchema>;

export const TenantContextSchema = z.object({
  organizationId: z.string().min(1, 'organizationId es requerido'),
  userId: z.string().min(1, 'userId es requerido'),
  role: RoleSchema.default('member'),
});
export type TenantContext = z.infer<typeof TenantContextSchema>;

// ==========================================
// ÁTOMOS (Partículas Fundamentales)
// ==========================================

export const AtomInputSchema = z.object({
  type: z.string().min(1).max(64).transform(val => val.trim().toLowerCase()),
  payload: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type AtomInput = z.infer<typeof AtomInputSchema>;

export const AtomSchema = AtomInputSchema.extend({
  id: z.string(),
  organizationId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Atom = z.infer<typeof AtomSchema>;

// ==========================================
// SINAPSIS / ENLACES (Enlaces Químicos)
// ==========================================

export const SynapseInputSchema = z.object({
  sourceAtomId: z.string().min(1),
  targetAtomId: z.string().min(1),
  relationType: z.string().min(1).max(64).transform(val => val.trim().toUpperCase()),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type SynapseInput = z.infer<typeof SynapseInputSchema>;

export const LinkSchema = SynapseInputSchema.extend({
  id: z.string(),
  organizationId: z.string(),
  createdAt: z.date(),
});
export type Link = z.infer<typeof LinkSchema>;

// ==========================================
// IDENTIDADES EXTERNAS (Google, ERPs, etc.)
// ==========================================

export const ExternalIdentityInputSchema = z.object({
  atomId: z.string().min(1),
  provider: z.string().min(1).max(64).transform(val => val.trim().toLowerCase()),
  externalId: z.string().min(1),
  syncHash: z.string().optional(),
});
export type ExternalIdentityInput = z.infer<typeof ExternalIdentityInputSchema>;

export const AtomExternalIdentitySchema = ExternalIdentityInputSchema.extend({
  id: z.string(),
  organizationId: z.string(),
  lastSyncedAt: z.date(),
});
export type AtomExternalIdentity = z.infer<typeof AtomExternalIdentitySchema>;

// ==========================================
// PROYECCIÓN MOLECULAR (Grafo Compuesto)
// ==========================================

export type SynapseNeighbor = {
  linkId: string;
  relationType: string;
  metadata: Record<string, unknown>;
  atom: Atom;
};

export type MolecularProjection = {
  root: Atom;
  outgoing: SynapseNeighbor[];
  incoming: SynapseNeighbor[];
  externalIdentities: AtomExternalIdentity[];
};
