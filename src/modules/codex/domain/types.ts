import { z } from 'zod';

export { AccessDeniedError } from './security/AccessGuard';

// ==========================================
// ROLES Y SEGURIDAD MULTI-TENANT
// ==========================================

export const RoleSchema = z.enum(['superadmin', 'owner', 'admin', 'member', 'viewer', 'guest']);
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

export type GetMoleculesOptions = {
  type?: string;
  status?: string;
  targetAtomId?: string;
  limit?: number;
  offset?: number;
};

export const UpdateAtomInputSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  rawText: z.string().optional(),
});
export type UpdateAtomInput = z.infer<typeof UpdateAtomInputSchema>;

// ==========================================
// CONTRATO UNIVERSAL DE INGESTA (IngestIntent)
// ==========================================

export const IngestSourceSchema = z.enum([
  'omnibar_regex',
  'ai_voice',
  'ai_agent',
  'chrome_extension',
  'google_addon',
  'api',
]);
export type IngestSource = z.infer<typeof IngestSourceSchema>;

export const CoreAtomIntentSchema = z.object({
  type: z.string().min(1).default('task'), // 'task', 'note', 'inbox', 'lead', etc.
  title: z.string().min(1),
  content: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type CoreAtomIntent = z.infer<typeof CoreAtomIntentSchema>;

export const SynapseIntentSchema = z.object({
  relationType: z.string().min(1), // 'ASSIGNED_TO', 'TAGGED_WITH', etc.
  targetEntityName: z.string().optional(), // ej. "Jose Carlos"
  targetAtomId: z.string().optional(), // si ya existe en la BD
  targetType: z.string().default('entity'), // 'entity', 'context', etc.
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type SynapseIntent = z.infer<typeof SynapseIntentSchema>;

export const TemporalIntentSchema = z.object({
  rawExpression: z.string(), // ej. "mañana a las 10"
  dueDate: z.date(),
  hasTime: z.boolean().default(false),
});
export type TemporalIntent = z.infer<typeof TemporalIntentSchema>;

export const IngestIntentSchema = z.object({
  rawText: z.string(),
  source: IngestSourceSchema.default('omnibar_regex'),
  coreAtom: CoreAtomIntentSchema,
  synapses: z.array(SynapseIntentSchema).default([]),
  temporal: TemporalIntentSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type IngestIntent = z.infer<typeof IngestIntentSchema>;

// ==========================================
// TOKENS EN TIEMPO REAL Y SUGERENCIAS UI
// ==========================================

export type ParsedEntityToken = {
  raw: string; // ej. "@Jose Carlos"
  name: string; // ej. "Jose Carlos"
  startIndex: number;
  endIndex: number;
  matchedAtomId?: string;
};

export type ParsedTemporalToken = {
  raw: string; // ej. "//mañana 10am"
  expression: string; // ej. "mañana 10am"
  date: Date;
  hasTime: boolean;
  startIndex: number;
  endIndex: number;
};

export type ParsedContextToken = {
  raw: string; // ej. "#ObraCasa"
  name: string; // ej. "ObraCasa"
  startIndex: number;
  endIndex: number;
};

export type ParsedPhoneToken = {
  raw: string; // ej. "+34 610 932 115"
  number: string; // normalizado ej. "610932115" o "+34610932115"
  startIndex: number;
  endIndex: number;
};

export type ParsedEmailToken = {
  raw: string; // ej. "contacto@empresa.com"
  email: string; // en minúsculas
  startIndex: number;
  endIndex: number;
};

export type ParsedActionType = 'call' | 'visit' | 'review' | 'send' | 'confirm' | 'custom';

export type ParsedActionToken = {
  raw: string; // ej. "llamar", "visitar", "revisar"
  action: ParsedActionType;
  label: string; // ej. "Llamada", "Visita", "Revisión"
  startIndex: number;
  endIndex: number;
};

export type ParsedConditionToken = {
  raw: string; // ej. "si no llueve", "tal vez"
  expression: string;
  startIndex: number;
  endIndex: number;
};

export type ParsedDocumentType = 'dni' | 'nie' | 'cif';

export type ParsedDocumentToken = {
  raw: string; // ej. "12345678Z", "B12345678", "X1234567L"
  documentNumber: string; // normalizado sin espacios ni guiones en mayúsculas
  type: ParsedDocumentType;
  isValid: boolean;
  startIndex: number;
  endIndex: number;
};

export type ParsedLocationType = 'coordinates' | 'plus_code' | 'address';

export type ParsedLocationToken = {
  raw: string; // ej. "40.8123, 0.5214", "8FX28399+Q2", "Calle Mayor 12"
  type: ParsedLocationType;
  normalized: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  startIndex: number;
  endIndex: number;
};

export type SyntagmaChunkType = 'address' | 'contact' | 'entity' | 'event' | 'general' | 'task';

export type ParsedSyntagmaChunk = {
  type: SyntagmaChunkType;
  raw: string;
  cleanText: string;
  startIndex: number;
  endIndex: number;
  meta?: Record<string, unknown>;
};

export type ParsedTokens = {
  entities: ParsedEntityToken[];
  contexts: ParsedContextToken[];
  temporal?: ParsedTemporalToken;
  phones: ParsedPhoneToken[];
  emails: ParsedEmailToken[];
  documents: ParsedDocumentToken[];
  locations: ParsedLocationToken[];
  actions: ParsedActionToken[];
  conditions: ParsedConditionToken[];
  chunks: ParsedSyntagmaChunk[];
  cleanText: string;
};

export type OmnibarSuggestion = {
  id: string;
  label: string;
  type: 'entity' | 'context';
  subtitle?: string;
  isCreateNew?: boolean;
};
