import type { MolecularProjection } from '@/modules/codex/domain/types';
import {
  aggregateEntityIdentity,
  extractTemporalDimension,
  formatDateKey,
} from '@/modules/codex/domain/services/viewHelpers';

type GoogleSyncEligibilityStatus
  = | 'eligible'
    | 'already_synced'
    | 'tentative_requires_confirmation'
    | 'missing_date'
    | 'non_calendar_type'
    | 'explicitly_excluded'
    | 'deleted';

export type GoogleSyncEligibility = {
  isEligible: boolean;
  status: GoogleSyncEligibilityStatus;
  reason: string;
  canForceSync?: boolean;
  missingRequirements?: string[];
};

export type GoogleCalendarEventPayload = {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  extendedProperties?: {
    private: {
      gorilaAtomId: string;
      gorilaOrganizationId: string;
      gorilaSyncHash: string;
      gorilaVersion: string;
    };
  };
};

export type GoogleSyncOptions = {
  defaultDurationMinutes?: number; // por defecto 60 min
  allowTentative?: boolean; // si es true, sincroniza con status: 'tentative'
  allowTasks?: boolean; // si es true, tareas con fecha también sincronizan
  includeAttendees?: boolean; // por defecto false (para evitar invitaciones no deseadas)
  timeZone?: string; // por defecto 'Europe/Madrid'
  deepLinkBaseUrl?: string; // por defecto 'https://gorila.serveix.work'
};

/**
 * Busca si la molécula ya posee una identidad externa con Google Calendar.
 */
export function extractGoogleCalendarExternalIdentity(molecule: MolecularProjection): {
  externalId: string;
  syncHash: string | null;
  lastSyncedAt: Date | null;
} | null {
  const match = (molecule.externalIdentities ?? []).find(
    id => id.provider === 'google_calendar',
  );

  if (!match) {
    return null;
  }

  return {
    externalId: match.externalId,
    syncHash: match.syncHash ?? null,
    lastSyncedAt: match.lastSyncedAt ? new Date(match.lastSyncedAt) : null,
  };
}

/**
 * Evalúa si una molécula o átomo de Gorila es apto para sincronizarse con Google Calendar.
 */
export function assessGoogleCalendarEligibility(
  molecule: MolecularProjection,
  options: GoogleSyncOptions = {},
): GoogleSyncEligibility {
  const { root } = molecule;
  const payload = (root.payload ?? {}) as Record<string, unknown>;
  const metadata = (root.metadata ?? {}) as Record<string, unknown>;

  // 1. Borrado lógico (Soft delete)
  const isDeleted = Boolean(
    payload.deletedAt
    || payload.isDeleted
    || metadata.deleted_at
    || metadata.is_deleted,
  );
  if (isDeleted) {
    return {
      isEligible: false,
      status: 'deleted',
      reason: 'El átomo está marcado como eliminado en Gorila.',
    };
  }

  // 2. Exclusión explícita por configuración
  if (payload.syncGoogle === false || metadata.sync_calendar === false) {
    return {
      isEligible: false,
      status: 'explicitly_excluded',
      reason: 'El elemento tiene deshabilitada la sincronización con Google Calendar.',
    };
  }

  // 3. Verificación de tipo semántico
  const isEvent = root.type === 'event';
  const isTask = root.type === 'task';
  if (!isEvent && (!isTask || !options.allowTasks)) {
    return {
      isEligible: false,
      status: 'non_calendar_type',
      reason: `Los átomos de tipo '${root.type}' no se sincronizan con Google Calendar por defecto.`,
      canForceSync: true,
    };
  }

  // 4. Extracción de dimensión temporal
  const temporal = extractTemporalDimension(molecule);
  if (!temporal.hasDate || !temporal.date || !temporal.dateKey) {
    return {
      isEligible: false,
      status: 'missing_date',
      reason: 'Google Calendar exige una fecha de inicio válida. Este átomo no tiene fecha asignada.',
      missingRequirements: ['Fecha de inicio (start.date o start.dateTime)'],
    };
  }

  // 5. Gestión de eventos tentativos / condicionales
  if (temporal.isTentative && !options.allowTentative) {
    return {
      isEligible: false,
      status: 'tentative_requires_confirmation',
      reason: 'El evento es condicional o tentativo. Confirma la fecha definitiva antes de enviarlo a Google.',
      canForceSync: true,
      missingRequirements: ['Confirmación de fecha no tentativa'],
    };
  }

  // 6. Verificar si ya está sincronizado
  const existingIdentity = extractGoogleCalendarExternalIdentity(molecule);
  if (existingIdentity) {
    return {
      isEligible: true,
      status: 'already_synced',
      reason: `Sincronizado previamente con ID: ${existingIdentity.externalId}`,
    };
  }

  return {
    isEligible: true,
    status: 'eligible',
    reason: 'El evento cumple todos los requisitos canónicos para sincronizarse con Google Calendar.',
  };
}

/**
 * Calcula un hash determinista y ligero para comparar si el evento ha cambiado
 * y evitar llamadas redundantes a la API de Google (0 coste / Idempotencia).
 */
export function computeGoogleSyncHash(data: {
  summary: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  status?: string;
}): string {
  const content = [
    data.summary.trim(),
    data.start,
    data.end,
    (data.location ?? '').trim(),
    (data.description ?? '').trim(),
    data.status ?? 'confirmed',
  ].join('|');

  // Hash polinomial simple FNV-1a de 32 bits a hex
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `sync_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Transforma una molécula de Gorila en un payload oficial de Google Calendar Event (API v3).
 * Aplica síntesis de fecha fin automática, vinculación de ubicación y enriquecimiento de asistentes.
 */
export function transformMoleculeToGoogleEvent(
  molecule: MolecularProjection,
  options: GoogleSyncOptions = {},
): GoogleCalendarEventPayload | null {
  const eligibility = assessGoogleCalendarEligibility(molecule, options);
  if (!eligibility.isEligible && eligibility.status !== 'already_synced') {
    return null;
  }

  const { root, outgoing = [] } = molecule;
  const payload = (root.payload ?? {}) as Record<string, unknown>;
  const temporal = extractTemporalDimension(molecule);

  if (!temporal.hasDate || !temporal.date) {
    return null;
  }

  const defaultDuration = options.defaultDurationMinutes ?? 60;
  const timeZone = options.timeZone ?? 'Europe/Madrid';
  const baseUrl = options.deepLinkBaseUrl ?? 'https://gorila.serveix.work';

  // 1. Cálculo de Start y End (RFC 5545 / Google Calendar API)
  let startObj: { dateTime?: string; date?: string; timeZone?: string };
  let endObj: { dateTime?: string; date?: string; timeZone?: string };

  if (temporal.isAllDay) {
    // Evento de Todo el Día: Google exige start.date (YYYY-MM-DD) y end.date como el DÍA SIGUIENTE (exclusivo)
    const startDateKey = temporal.dateKey!;
    const nextDay = new Date(temporal.date);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDateKey = formatDateKey(nextDay);

    startObj = { date: startDateKey };
    endObj = { date: endDateKey };
  } else {
    // Evento con Hora: Google exige start.dateTime y end.dateTime
    const startIso = temporal.date.toISOString();

    // Fecha fin explícita o calculada con duración por defecto
    let endDate: Date;
    if (typeof payload.endDate === 'string' && !Number.isNaN(new Date(payload.endDate).getTime())) {
      endDate = new Date(payload.endDate);
    } else {
      endDate = new Date(temporal.date.getTime() + defaultDuration * 60 * 1000);
    }
    const endIso = endDate.toISOString();

    startObj = { dateTime: startIso, timeZone };
    endObj = { dateTime: endIso, timeZone };
  }

  // 2. Síntesis de Título / Resumen
  let summary = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : null;

  // 3. Resolución de Entidades Vinculadas (Cliente, Dirección, Contacto)
  let linkedClientName: string | null = null;
  let linkedPhone: string | null = null;
  let linkedEmail: string | null = null;
  let linkedLocationStr: string | null = null;

  for (const syn of outgoing) {
    const target = syn.atom;
    if (!target) {
      continue;
    }

    const tPayload = (target.payload ?? {}) as Record<string, unknown>;

    // Cliente vinculado
    if (target.type === 'client' || target.type === 'contact') {
      const identity = aggregateEntityIdentity(target, []);
      linkedClientName = identity.primaryName;
      linkedPhone = identity.phones[0] ?? null;
      linkedEmail = identity.emails[0] ?? null;
    }

    // Ubicación / Dirección vinculada
    const relUpper = (syn.relationType ?? '').toUpperCase();
    if (target.type === 'location' || relUpper === 'AT_LOCATION' || relUpper === 'LOCATION') {
      const addressParts = [
        tPayload.street,
        tPayload.number,
        tPayload.city,
        tPayload.province,
      ].filter(Boolean);

      if (addressParts.length > 0) {
        linkedLocationStr = addressParts.join(', ');
      } else if (typeof tPayload.title === 'string') {
        linkedLocationStr = tPayload.title;
      }
    }
  }

  if (!summary) {
    if (linkedClientName) {
      summary = `Cita con ${linkedClientName}`;
    } else {
      summary = root.type === 'task' ? 'Tarea Programada' : 'Evento Gorila';
    }
  }

  // 4. Construcción de Descripción Enriquecida
  const descriptionLines: string[] = [];
  if (typeof payload.notes === 'string' && payload.notes.trim()) {
    descriptionLines.push(payload.notes.trim());
  } else if (typeof payload.description === 'string' && payload.description.trim()) {
    descriptionLines.push(payload.description.trim());
  }

  if (linkedClientName) {
    descriptionLines.push(`👤 Cliente: ${linkedClientName}`);
  }
  if (linkedPhone) {
    descriptionLines.push(`📞 Teléfono: ${linkedPhone}`);
  }

  // Deep Link a Gorila para acceder con 1 clic desde Google Calendar
  descriptionLines.push('');
  descriptionLines.push(`🔗 Abrir en Gorila SaaS: ${baseUrl}/dashboard/codex?molecule=${root.id}`);

  const description = descriptionLines.join('\n');

  // 5. Asistentes / Invitados (opcional y configurable)
  const attendees: Array<{ email: string; displayName?: string }> = [];
  if (options.includeAttendees && linkedEmail) {
    attendees.push({
      email: linkedEmail,
      ...(linkedClientName ? { displayName: linkedClientName } : {}),
    });
  }

  // 6. Cálculo de Hash de Sincronización
  const syncHash = computeGoogleSyncHash({
    summary,
    start: startObj.dateTime ?? startObj.date!,
    end: endObj.dateTime ?? endObj.date!,
    location: linkedLocationStr ?? undefined,
    description,
    status: temporal.isTentative ? 'tentative' : 'confirmed',
  });

  const existingIdentity = extractGoogleCalendarExternalIdentity(molecule);

  return {
    ...(existingIdentity ? { id: existingIdentity.externalId } : {}),
    summary,
    description,
    location: linkedLocationStr ?? undefined,
    start: startObj,
    end: endObj,
    status: temporal.isTentative ? 'tentative' : 'confirmed',
    ...(attendees.length > 0 ? { attendees } : {}),
    extendedProperties: {
      private: {
        gorilaAtomId: root.id,
        gorilaOrganizationId: root.organizationId,
        gorilaSyncHash: syncHash,
        gorilaVersion: '1.0',
      },
    },
  };
}
