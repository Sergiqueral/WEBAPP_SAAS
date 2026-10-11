import { describe, expect, it } from 'vitest';
import { AccessDeniedError } from '@/libs/biology/AccessGuard';
import { OmnibarParser } from '@/libs/omnibar/OmnibarParser';
import { OmnibarReactor } from '@/libs/omnibar/OmnibarReactor';

describe('Omnibarra Mecánica: OmnibarParser', () => {
  // Fecha fija de referencia: Martes 20 de Octubre de 2026, 09:00:00
  const referenceDate = new Date(2026, 9, 20, 9, 0, 0);

  const knownEntities = [
    { id: 'atom-jc', name: 'Jose Carlos' },
    { id: 'atom-carlos', name: 'Carlos' },
    { id: 'atom-maria', name: 'Maria Lopez' },
  ];

  describe('Texto Plano (Fallback a Átomo Inbox)', () => {
    it('convierte texto sin etiquetas en un átomo neutro tipo inbox', () => {
      const input = 'Comprar pintura blanca para el salón';
      const intent = OmnibarParser.parseToIntent(input, { referenceDate });

      expect(intent.coreAtom.type).toBe('inbox');
      expect(intent.coreAtom.title).toBe('Comprar pintura blanca para el salón');
      expect(intent.synapses).toHaveLength(0);
      expect(intent.temporal).toBeUndefined();
    });
  });

  describe('Delimitación de Nombres Compuestos (@Jose Carlos vs @Carlos)', () => {
    it('absorbe el nombre compuesto completo si existe en la lista de entidades conocidas (Greedy match)', () => {
      const input = 'Revisar planos con @Jose Carlos en la obra';
      const intent = OmnibarParser.parseToIntent(input, {
        knownEntities,
        referenceDate,
      });

      expect(intent.synapses).toHaveLength(1);

      const entitySynapse = intent.synapses[0]!;

      expect(entitySynapse.relationType).toBe('ASSIGNED_TO');
      expect(entitySynapse.targetEntityName).toBe('Jose Carlos');
      expect(entitySynapse.targetAtomId).toBe('atom-jc');

      // Comprobar que "en la obra" permanece en el texto limpio
      expect(intent.coreAtom.title).toBe('Revisar planos con en la obra');
    });

    it('absorbe solo el nombre simple si solo existe Carlos y no Jose Carlos', () => {
      const input = 'Revisar planos con @Carlos en la obra';
      const intent = OmnibarParser.parseToIntent(input, {
        knownEntities,
        referenceDate,
      });

      expect(intent.synapses).toHaveLength(1);

      const entitySynapse = intent.synapses[0]!;

      expect(entitySynapse.targetEntityName).toBe('Carlos');
      expect(entitySynapse.targetAtomId).toBe('atom-carlos');
    });

    it('delimita una entidad nueva no conocida por mayúsculas o siguiente token', () => {
      const input = 'Llamar a @Roberto Gomez para confirmar cita';
      const intent = OmnibarParser.parseToIntent(input, { referenceDate });

      expect(intent.synapses).toHaveLength(1);

      const entitySynapse = intent.synapses[0]!;

      expect(entitySynapse.targetEntityName).toBe('Roberto Gomez');
      expect(entitySynapse.targetAtomId).toBeUndefined();
    });
  });

  describe('Lenguaje Natural Temporal en Español (//...)', () => {
    it('interpreta "//mañana a las 10" con fecha y hora exactas', () => {
      const input = 'Reunión de seguimiento //mañana a las 10:00';
      const intent = OmnibarParser.parseToIntent(input, { referenceDate });

      expect(intent.coreAtom.type).toBe('task');
      expect(intent.coreAtom.title).toBe('Reunión de seguimiento');
      expect(intent.temporal).toBeDefined();
      expect(intent.temporal?.hasTime).toBe(true);

      const dueDate = intent.temporal!.dueDate;

      // 21 de Octubre de 2026 a las 10:00
      expect(dueDate.getDate()).toBe(21);
      expect(dueDate.getMonth()).toBe(9); // Octubre (0-indexed)
      expect(dueDate.getHours()).toBe(10);
      expect(dueDate.getMinutes()).toBe(0);
    });

    it('interpreta expresiones relativas como "//en 3 días"', () => {
      const input = 'Entregar presupuesto //en 3 días';
      const intent = OmnibarParser.parseToIntent(input, { referenceDate });

      expect(intent.temporal).toBeDefined();
      expect(intent.temporal?.dueDate.getDate()).toBe(23); // 20 + 3
    });
  });

  describe('Contextos y Etiquetas (#...)', () => {
    it('extrae etiquetas simples y con caracteres en español', () => {
      const input = 'Revisar instalación eléctrica #ObraCasa #Construcción';
      const intent = OmnibarParser.parseToIntent(input, { referenceDate });

      const contextSynapses = intent.synapses.filter(
        s => s.relationType === 'TAGGED_WITH',
      );

      expect(contextSynapses).toHaveLength(2);
      expect(contextSynapses[0]?.targetEntityName).toBe('ObraCasa');
      expect(contextSynapses[1]?.targetEntityName).toBe('Construcción');
      expect(intent.coreAtom.title).toBe('Revisar instalación eléctrica');
    });
  });

  describe('Entrada Molecular Completa (Combinación Total)', () => {
    it('procesa texto con entidad, fecha y contexto al unísono', () => {
      const input = 'Revisar planos con @Jose Carlos //mañana a las 10:00 para #ObraCasa';
      const intent = OmnibarParser.parseToIntent(input, {
        knownEntities,
        referenceDate,
      });

      expect(intent.coreAtom.type).toBe('task');
      expect(intent.coreAtom.title).toBe('Revisar planos con para');

      // Entidad
      const entity = intent.synapses.find(s => s.relationType === 'ASSIGNED_TO');

      expect(entity?.targetEntityName).toBe('Jose Carlos');
      expect(entity?.targetAtomId).toBe('atom-jc');

      // Contexto
      const context = intent.synapses.find(s => s.relationType === 'TAGGED_WITH');

      expect(context?.targetEntityName).toBe('ObraCasa');

      // Temporal
      expect(intent.temporal?.hasTime).toBe(true);
      expect(intent.temporal?.dueDate.getHours()).toBe(10);
    });
  });

  describe('OmnibarReactor: Seguridad y Control de Acceso', () => {
    it('bloquea tajantemente la ingesta si el usuario tiene rol viewer', async () => {
      const viewerContext = {
        organizationId: 'org-test',
        userId: 'user-viewer',
        role: 'viewer' as const,
      };

      await expect(
        OmnibarReactor.ingest(viewerContext, 'Tarea no autorizada'),
      ).rejects.toThrow(AccessDeniedError);
    });

    it('bloquea la ingesta si el usuario tiene rol guest', async () => {
      const guestContext = {
        organizationId: 'org-test',
        userId: 'user-guest',
        role: 'guest' as const,
      };

      await expect(
        OmnibarReactor.ingest(guestContext, 'Intento de escritura de invitado'),
      ).rejects.toThrow(AccessDeniedError);
    });
  });
});
