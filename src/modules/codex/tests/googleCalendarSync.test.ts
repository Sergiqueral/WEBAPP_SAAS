import type { Atom, MolecularProjection } from '@/modules/codex/domain/types';
import { describe, expect, it } from 'vitest';
import {
  assessGoogleCalendarEligibility,
  computeGoogleSyncHash,
  extractGoogleCalendarExternalIdentity,
  transformMoleculeToGoogleEvent,
} from '@/modules/codex/domain/services/googleCalendarSync';

describe('Sincronización con Google Calendar - Elegibilidad y Transformador Canónico', () => {
  const createMockMolecule = (options: {
    id: string;
    type?: string;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    deletedAt?: Date | null;
    outgoing?: MolecularProjection['outgoing'];
    externalIdentities?: MolecularProjection['externalIdentities'];
  }): MolecularProjection => ({
    root: {
      id: options.id,
      organizationId: 'org-test-1',
      type: options.type ?? 'event',
      payload: {
        ...(options.payload ?? {}),
        ...(options.deletedAt !== undefined ? { deletedAt: options.deletedAt } : {}),
      },
      metadata: options.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    outgoing: options.outgoing ?? [],
    incoming: [],
    externalIdentities: options.externalIdentities ?? [],
  });

  describe('Evaluación de Elegibilidad (assessGoogleCalendarEligibility)', () => {
    it('rechaza átomos sin fecha con código missing_date', () => {
      const mol = createMockMolecule({
        id: 'no-date-1',
        type: 'event',
        payload: { title: 'Reunión sin fecha definida' },
      });

      const eligibility = assessGoogleCalendarEligibility(mol);

      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.status).toBe('missing_date');
      expect(eligibility.missingRequirements).toContain('Fecha de inicio (start.date o start.dateTime)');
    });

    it('rechaza eventos tentativos si allowTentative es false (por defecto)', () => {
      const mol = createMockMolecule({
        id: 'tentative-1',
        type: 'event',
        payload: {
          title: 'Posible visita si para de llover',
          dueDate: '2026-10-22T10:00:00Z',
          isTentative: true,
        },
      });

      const eligibility = assessGoogleCalendarEligibility(mol);

      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.status).toBe('tentative_requires_confirmation');
      expect(eligibility.canForceSync).toBe(true);
    });

    it('admite eventos tentativos si se habilita allowTentative explícitamente', () => {
      const mol = createMockMolecule({
        id: 'tentative-2',
        type: 'event',
        payload: {
          title: 'Borrador de cita',
          dueDate: '2026-10-22T10:00:00Z',
          isTentative: true,
        },
      });

      const eligibility = assessGoogleCalendarEligibility(mol, { allowTentative: true });

      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.status).toBe('eligible');
    });

    it('rechaza átomos con borrado lógico (soft deletes)', () => {
      const mol = createMockMolecule({
        id: 'deleted-1',
        type: 'event',
        payload: { title: 'Visita cancelada', dueDate: '2026-10-22' },
        deletedAt: new Date(),
      });

      const eligibility = assessGoogleCalendarEligibility(mol);

      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.status).toBe('deleted');
    });

    it('rechaza átomos con exclusión explícita syncGoogle = false', () => {
      const mol = createMockMolecule({
        id: 'private-1',
        type: 'event',
        payload: { title: 'Cita privada médica', dueDate: '2026-10-22', syncGoogle: false },
      });

      const eligibility = assessGoogleCalendarEligibility(mol);

      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.status).toBe('explicitly_excluded');
    });

    it('rechaza notas por defecto a menos que se fuerce su sincronización', () => {
      const mol = createMockMolecule({
        id: 'note-1',
        type: 'note',
        payload: { title: 'Nota con fecha', dueDate: '2026-10-22' },
      });

      const eligibility = assessGoogleCalendarEligibility(mol);

      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.status).toBe('non_calendar_type');
    });

    it('reconoce cuando el evento ya está sincronizado previamente', () => {
      const mol = createMockMolecule({
        id: 'synced-1',
        type: 'event',
        payload: { title: 'Reunión ya enviada', dueDate: '2026-10-22' },
        externalIdentities: [
          {
            id: 'ext-1',
            organizationId: 'org-test-1',
            atomId: 'synced-1',
            provider: 'google_calendar',
            externalId: 'google_event_xyz123',
            syncHash: 'sync_aabbcc',
            lastSyncedAt: new Date(),
          },
        ],
      });

      const ext = extractGoogleCalendarExternalIdentity(mol);

      expect(ext).not.toBeNull();
      expect(ext?.externalId).toBe('google_event_xyz123');

      const eligibility = assessGoogleCalendarEligibility(mol);

      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.status).toBe('already_synced');
      expect(eligibility.reason).toContain('google_event_xyz123');
    });
  });

  describe('Transformador Canónico a Google Calendar (transformMoleculeToGoogleEvent)', () => {
    it('transforma un evento de Todo el Día con start.date y end.date al día siguiente', () => {
      const mol = createMockMolecule({
        id: 'allday-1',
        type: 'event',
        payload: {
          title: 'Feria de Muestras',
          dueDate: '2026-10-25',
        },
      });

      const event = transformMoleculeToGoogleEvent(mol);

      expect(event).not.toBeNull();
      expect(event?.summary).toBe('Feria de Muestras');
      expect(event?.start.date).toBe('2026-10-25');
      expect(event?.end.date).toBe('2026-10-26'); // Día siguiente en RFC 5545
      expect(event?.start.dateTime).toBeUndefined();
    });

    it('transforma un evento con hora calculando duración por defecto de 60 minutos', () => {
      const startTime = new Date(2026, 9, 22, 10, 30);
      const mol = createMockMolecule({
        id: 'timed-1',
        type: 'event',
        payload: {
          title: 'Reparación de caldera',
          dueDate: startTime.toISOString(),
        },
      });

      const event = transformMoleculeToGoogleEvent(mol, { defaultDurationMinutes: 60 });

      expect(event).not.toBeNull();
      expect(event?.summary).toBe('Reparación de caldera');
      expect(event?.start.dateTime).toBe(startTime.toISOString());

      const expectedEnd = new Date(startTime.getTime() + 60 * 60 * 1000);

      expect(event?.end.dateTime).toBe(expectedEnd.toISOString());
    });

    it('enriquece el evento con cliente, teléfono y dirección desde las sinapsis moleculares', () => {
      const clientAtom: Atom = {
        id: 'client-carlos',
        organizationId: 'org-test-1',
        type: 'client',
        payload: { name: 'Carlos Garcia', phone: '+34654887744', email: 'carlos@ejemplo.com' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const locationAtom: Atom = {
        id: 'loc-camarles',
        organizationId: 'org-test-1',
        type: 'location',
        payload: { street: 'Calle Camarles', number: '23', city: 'Tarragona' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mol = createMockMolecule({
        id: 'event-with-client',
        type: 'event',
        payload: {
          dueDate: '2026-10-22',
          notes: 'Reparar grifo que gotea',
        },
        outgoing: [
          {
            linkId: 'syn-1',
            relationType: 'WITH_CLIENT',
            metadata: {},
            atom: clientAtom,
          },
          {
            linkId: 'syn-2',
            relationType: 'AT_LOCATION',
            metadata: {},
            atom: locationAtom,
          },
        ],
      });

      const event = transformMoleculeToGoogleEvent(mol, { includeAttendees: true });

      expect(event).not.toBeNull();
      // Síntesis de título automático porque payload.title no existía
      expect(event?.summary).toBe('Cita con Carlos Garcia');
      // Inyección de ubicación física
      expect(event?.location).toBe('Calle Camarles, 23, Tarragona');
      // Inyección de notas y teléfono en descripción
      expect(event?.description).toContain('Reparar grifo que gotea');
      expect(event?.description).toContain('👤 Cliente: Carlos Garcia');
      expect(event?.description).toContain('📞 Teléfono: +34654887744');
      expect(event?.description).toContain('🔗 Abrir en Gorila SaaS:');
      // Inyección de invitado
      expect(event?.attendees).toHaveLength(1);
      expect(event?.attendees?.[0]?.email).toBe('carlos@ejemplo.com');
      expect(event?.attendees?.[0]?.displayName).toBe('Carlos Garcia');
    });

    it('incluye syncHash e identificador privado en extendedProperties para idempotencia', () => {
      const mol = createMockMolecule({
        id: 'idempotent-1',
        type: 'event',
        payload: { title: 'Prueba hash', dueDate: '2026-10-22' },
      });

      const event = transformMoleculeToGoogleEvent(mol);

      expect(event?.extendedProperties?.private.gorilaAtomId).toBe('idempotent-1');
      expect(event?.extendedProperties?.private.gorilaOrganizationId).toBe('org-test-1');
      expect(event?.extendedProperties?.private.gorilaSyncHash).toMatch(/^sync_[0-9a-f]{8}$/);
    });
  });

  describe('Cálculo de Hash Criptográfico / Idempotencia (computeGoogleSyncHash)', () => {
    it('genera el mismo hash si los datos relevantes no cambian', () => {
      const hash1 = computeGoogleSyncHash({
        summary: 'Reunión',
        start: '2026-10-22',
        end: '2026-10-23',
        location: 'Tarragona',
      });

      const hash2 = computeGoogleSyncHash({
        summary: 'Reunión',
        start: '2026-10-22',
        end: '2026-10-23',
        location: 'Tarragona',
      });

      expect(hash1).toBe(hash2);
    });

    it('genera un hash diferente si cambia el título, fecha o ubicación', () => {
      const hash1 = computeGoogleSyncHash({
        summary: 'Reunión inicial',
        start: '2026-10-22',
        end: '2026-10-23',
      });

      const hash2 = computeGoogleSyncHash({
        summary: 'Reunión aplazada',
        start: '2026-10-22',
        end: '2026-10-23',
      });

      expect(hash1).not.toBe(hash2);
    });
  });
});
