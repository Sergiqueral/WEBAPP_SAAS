import { z } from 'zod';

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

export type ParsedTokens = {
  entities: ParsedEntityToken[];
  contexts: ParsedContextToken[];
  temporal?: ParsedTemporalToken;
  cleanText: string;
};

export type OmnibarSuggestion = {
  id: string;
  label: string;
  type: 'entity' | 'context';
  subtitle?: string;
  isCreateNew?: boolean;
};
