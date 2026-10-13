import { describe, expect, it, vi } from 'vitest';
import { AtomRepository } from '@/modules/codex/domain/repositories/AtomRepository';
import { SynapseRepository } from '@/modules/codex/domain/repositories/SynapseRepository';
import { AccessDeniedError } from '@/modules/codex/domain/types';
import { OmnibarParser } from '@/modules/codex/omnibar/parser/OmnibarParser';
import { OmnibarReactor } from '@/modules/codex/omnibar/reactor/OmnibarReactor';

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
      expect(intent.coreAtom.title).toBe(
        'Comprar pintura blanca para el salón',
      );
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
      const input
        = 'Revisar planos con @Jose Carlos //mañana a las 10:00 para #ObraCasa';
      const intent = OmnibarParser.parseToIntent(input, {
        knownEntities,
        referenceDate,
      });

      expect(intent.coreAtom.type).toBe('task');
      expect(intent.coreAtom.title).toBe('Revisar planos con para');

      // Entidad
      const entity = intent.synapses.find(
        s => s.relationType === 'ASSIGNED_TO',
      );

      expect(entity?.targetEntityName).toBe('Jose Carlos');
      expect(entity?.targetAtomId).toBe('atom-jc');

      // Contexto
      const context = intent.synapses.find(
        s => s.relationType === 'TAGGED_WITH',
      );

      expect(context?.targetEntityName).toBe('ObraCasa');

      // Temporal
      expect(intent.temporal?.hasTime).toBe(true);
      expect(intent.temporal?.dueDate.getHours()).toBe(10);
    });
  });

  describe('Detectores de Anclajes Moleculares (Paso 1)', () => {
    it('extrae teléfonos automáticamente (móvil, fijo e internacional con prefijo +)', () => {
      const input
        = 'Llamar al 610932115 o al fijo 977 12 34 56 o internacional +34 610 932 115';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.phones).toHaveLength(3);
      expect(tokens.phones[0]?.number).toBe('610932115');
      expect(tokens.phones[1]?.number).toBe('977123456');
      expect(tokens.phones[2]?.number).toBe('+34610932115');
    });

    it('no confunde códigos postales (5 dígitos) ni años (4 dígitos) con teléfonos', () => {
      const input = 'Enviar paquete a Tortosa 43870 en el año 2026';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.phones).toHaveLength(0);
    });

    it('detecta correos electrónicos y evita colisión con el detector de entidades @', () => {
      const input
        = 'Enviar factura a soporte@serveix.me y copia a squeral@serveix.me';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.emails).toHaveLength(2);
      expect(tokens.emails[0]?.email).toBe('soporte@serveix.me');
      expect(tokens.emails[1]?.email).toBe('squeral@serveix.me');
      // No debe haber extraído @serveix.me como entidad
      expect(tokens.entities).toHaveLength(0);
    });

    it('detecta verbos de acción operativos (llamar, visitar, revisar, enviar, confirmar)', () => {
      const input = 'Llamar para confirmar cita y revisar el presupuesto';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.actions).toHaveLength(3);

      const actionTypes = tokens.actions.map(a => a.action);

      expect(actionTypes).toContain('call');
      expect(actionTypes).toContain('confirm');
      expect(actionTypes).toContain('review');
    });

    it('detecta expresiones de incertidumbre y condicionantes (si contesta, tal vez)', () => {
      const input = 'visitar la obra el viernes si contesta o tal vez llamar';
      const tokens = OmnibarParser.extractTokens(input, { referenceDate });

      expect(tokens.conditions.length).toBeGreaterThanOrEqual(1);

      const exprs = tokens.conditions.map(c => c.expression);

      expect(exprs).toContain('si contesta');
    });

    it('extrae fechas embebidas en lenguaje natural sin requerir prefijo //', () => {
      // Martes 20 Octubre 2026 -> "el miercoles" debe ser Miércoles 21 Octubre
      const input = 'Llamar al cliente el miercoles a las 11:00';
      const tokens = OmnibarParser.extractTokens(input, { referenceDate });

      expect(tokens.temporal).toBeDefined();
      expect(tokens.temporal?.date.getDate()).toBe(21);
      expect(tokens.temporal?.hasTime).toBe(true);
      expect(tokens.temporal?.date.getHours()).toBe(11);
    });

    it('detecta nombres propios sin @ basados en mayúsculas compuestas (ej. Jose Martines)', () => {
      const input = 'Jose Martines vive en Tortosa';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.entities).toHaveLength(1);
      expect(tokens.entities[0]?.name).toBe('Jose Martines');
    });

    it('resuelve el Caso de Uso 1 del usuario: "llamar al 610932115 el miercoles para confirmar la oferta"', () => {
      const input = 'llamar al 610932115 el miercoles para confirmar la oferta';
      const intent = OmnibarParser.parseToIntent(input, { referenceDate });

      expect(intent.coreAtom.type).toBe('task');
      expect(intent.coreAtom.title).toBe(
        'llamar al 610932115 para confirmar la oferta',
      );
      expect(intent.temporal).toBeDefined();
      expect(intent.temporal?.dueDate.getDate()).toBe(21); // Miércoles 21

      // Acciones registradas
      const payload = intent.coreAtom.payload as {
        phones?: string[];
        actions?: string[];
      };

      expect(payload.phones).toContain('610932115');
      expect(payload.actions).toContain('call');
      expect(payload.actions).toContain('confirm');

      // Sinapsis telefónica creada
      const phoneSynapse = intent.synapses.find(
        s => s.relationType === 'HAS_PHONE',
      );

      expect(phoneSynapse).toBeDefined();
      expect(phoneSynapse?.targetEntityName).toBe('610932115');
    });

    it('resuelve el Caso de Uso 2 del usuario: "Jose Martines 610932115 vive en Tortosa" (Ficha Cliente Emergente)', () => {
      const input = 'Jose Martines 610932115 vive en Tortosa';
      const intent = OmnibarParser.parseToIntent(input, { referenceDate });

      // Arquetipo detectado como ficha de cliente emergente
      expect(intent.coreAtom.type).toBe('client');
      expect(intent.coreAtom.title).toBe('Jose Martines');

      // Vinculación ancla
      const phoneSynapse = intent.synapses.find(
        s => s.relationType === 'HAS_PHONE',
      );

      expect(phoneSynapse).toBeDefined();
      expect(phoneSynapse?.targetEntityName).toBe('610932115');

      const entitySynapse = intent.synapses.find(
        s => s.relationType === 'ASSIGNED_TO',
      );

      expect(entitySynapse).toBeDefined();
      expect(entitySynapse?.targetEntityName).toBe('Jose Martines');
    });

    it('ambos casos de uso generan el mismo nodo ancla telefónico para interconectar el grafo', () => {
      const taskIntent = OmnibarParser.parseToIntent(
        'llamar al 610932115 el miercoles para confirmar la oferta',
        { referenceDate },
      );
      const clientIntent = OmnibarParser.parseToIntent(
        'Jose Martines 610932115 vive en Tortosa',
        { referenceDate },
      );

      const taskPhone = taskIntent.synapses.find(
        s => s.relationType === 'HAS_PHONE',
      );
      const clientPhone = clientIntent.synapses.find(
        s => s.relationType === 'HAS_PHONE',
      );

      expect(taskPhone?.targetEntityName).toBe('610932115');
      expect(clientPhone?.targetEntityName).toBe('610932115');
      expect(taskPhone?.targetEntityName).toBe(clientPhone?.targetEntityName);
    });
  });

  describe('Identificadores Fiscales Españoles (DNI, NIE, CIF - Paso 2)', () => {
    it('detecta y valida un DNI español válido por algoritmo módulo 23', () => {
      // 12345678 % 23 = 14 -> Z
      const input = 'Firma de contrato de DNI 12345678Z en la oficina';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.documents).toHaveLength(1);

      const doc = tokens.documents[0]!;

      expect(doc.type).toBe('dni');
      expect(doc.documentNumber).toBe('12345678Z');
      expect(doc.isValid).toBe(true);
    });

    it('detecta un DNI con letra incorrecta y lo marca como inválido (isValid: false)', () => {
      // 12345678 con letra A es errónea (debe ser Z)
      const input = 'Comprobar datos con DNI 12345678A urgente';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.documents).toHaveLength(1);

      const doc = tokens.documents[0]!;

      expect(doc.type).toBe('dni');
      expect(doc.documentNumber).toBe('12345678A');
      expect(doc.isValid).toBe(false);
    });

    it('detecta y valida un NIE español válido (X, Y, Z)', () => {
      // X1234567 -> 01234567 % 23 = 11 -> L
      const input = 'Documentación extranjería NIE X1234567L pendiente';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.documents).toHaveLength(1);

      const doc = tokens.documents[0]!;

      expect(doc.type).toBe('nie');
      expect(doc.documentNumber).toBe('X1234567L');
      expect(doc.isValid).toBe(true);
    });

    it('detecta y valida un CIF de sociedad español válido', () => {
      // CIF B12345674 (Sociedad de Responsabilidad Limitada)
      const input = 'Facturar a la empresa con CIF B12345674';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.documents).toHaveLength(1);

      const doc = tokens.documents[0]!;

      expect(doc.type).toBe('cif');
      expect(doc.documentNumber).toBe('B12345674');
      expect(doc.isValid).toBe(true);
    });

    it('no confunde números de teléfono estándar con DNIs', () => {
      const input = 'Llamar al 610932115 para pedir presupuesto';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.phones).toHaveLength(1);
      expect(tokens.phones[0]?.number).toBe('610932115');
      expect(tokens.documents).toHaveLength(0);
    });

    it('genera sinapsis HAS_DOCUMENT y clasifica como cliente si hay entidad + documento fiscal', () => {
      const input = 'Jose Martines DNI 12345678Z socio fundador';
      const intent = OmnibarParser.parseToIntent(input);

      expect(intent.coreAtom.type).toBe('client');
      expect(intent.coreAtom.title).toBe('Jose Martines');

      const docSynapse = intent.synapses.find(
        s => s.relationType === 'HAS_DOCUMENT',
      );

      expect(docSynapse).toBeDefined();
      expect(docSynapse?.targetEntityName).toBe('12345678Z');

      const payload = intent.coreAtom.payload as {
        documents?: string[];
      };

      expect(payload.documents?.[0]).toBe('12345678Z');
    });
  });

  describe('Detección y Normalización de Ubicaciones Geográficas (Paso 2)', () => {
    it('extrae coordenadas GPS en formato decimal con latitud y longitud', () => {
      const input = 'Inspección de terreno en 40.8123, 0.5214 mañana';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.locations).toHaveLength(1);

      const loc = tokens.locations[0]!;

      expect(loc.type).toBe('coordinates');
      expect(loc.normalized).toBe('40.8123, 0.5214');
    });

    it('extrae coordenadas GPS con valores negativos', () => {
      const input = 'Punto de encuentro en -34.6037, -58.3816 para entrega';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.locations).toHaveLength(1);

      const loc = tokens.locations[0]!;

      expect(loc.type).toBe('coordinates');
      expect(loc.normalized).toBe('-34.6037, -58.3816');
    });

    it('extrae Plus Codes de Google Maps globales y locales', () => {
      // Global
      const inputGlobal = 'Instalación de fibra en 8FX28399+Q2 confirmada';
      const tokensGlobal = OmnibarParser.extractTokens(inputGlobal);

      expect(tokensGlobal.locations).toHaveLength(1);
      expect(tokensGlobal.locations[0]?.type).toBe('plus_code');
      expect(tokensGlobal.locations[0]?.normalized).toBe('8FX28399+Q2');

      // Local con ciudad
      const inputLocal = 'Descarga de material en 8399+Q2 Tortosa el viernes';
      const tokensLocal = OmnibarParser.extractTokens(inputLocal);

      expect(tokensLocal.locations).toHaveLength(1);
      expect(tokensLocal.locations[0]?.type).toBe('plus_code');
      expect(tokensLocal.locations[0]?.normalized).toBe('8399+Q2 Tortosa');
    });

    it('extrae direcciones viales en español (calles, avenidas, paseos)', () => {
      const input = 'Visita técnica en c/ Pau Casals 12, 43870 Tortosa a las 16:00';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.locations).toHaveLength(1);

      const loc = tokens.locations[0]!;

      expect(loc.type).toBe('address');
      expect(loc.normalized.toLowerCase()).toContain('pau casals 12');
    });

    it('genera sinapsis AT_LOCATION en el Intent para vincular la entidad geográfica', () => {
      const input = 'Revisión de obra en calle Mayor 15 #Construcción';
      const intent = OmnibarParser.parseToIntent(input);

      const locSynapse = intent.synapses.find(
        s => s.relationType === 'AT_LOCATION',
      );

      expect(locSynapse).toBeDefined();
      expect(locSynapse?.targetEntityName?.toLowerCase()).toContain('calle mayor 15');

      const payload = intent.coreAtom.payload as {
        locations?: Array<{ normalized: string }>;
      };

      expect(payload.locations).toHaveLength(1);
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

  describe('Omnibar UI & Autocompletado: Lógica Reactiva', () => {
    it('filtra entidades conocidas y ofrece opción de creación dinámica al teclear @', () => {
      const known = [
        { id: '1', name: 'Jose Carlos' },
        { id: '2', name: 'Maria Gomez' },
      ];

      // Caso A: Coincidencia con entidad existente
      const queryA = 'jose';
      const matchesA = known.filter(e =>
        e.name.toLowerCase().includes(queryA.toLowerCase()),
      );

      expect(matchesA).toHaveLength(1);
      expect(matchesA[0]?.name).toBe('Jose Carlos');

      // Caso B: Entidad completamente nueva
      const queryB = 'Pedro';
      const matchesB = known.filter(e =>
        e.name.toLowerCase().includes(queryB.toLowerCase()),
      );

      expect(matchesB).toHaveLength(0);

      const isCreateNew
        = queryB.trim().length > 0
          && !matchesB.some(m => m.name.toLowerCase() === queryB.toLowerCase());

      expect(isCreateNew).toBe(true);
    });

    it('determina correctamente la huella molecular según los tokens presentes', () => {
      // Sin tokens -> inbox
      const tokensInbox = OmnibarParser.extractTokens('Comprar leche y pan');
      const hasTokensInbox
        = tokensInbox.entities.length > 0
          || tokensInbox.contexts.length > 0
          || !!tokensInbox.temporal;
      const typeInbox = hasTokensInbox
        ? tokensInbox.temporal
          ? 'task'
          : 'note'
        : 'inbox';

      expect(typeInbox).toBe('inbox');

      // Con fecha -> task
      const tokensTask = OmnibarParser.extractTokens('Revisión //mañana');
      const hasTokensTask
        = tokensTask.entities.length > 0
          || tokensTask.contexts.length > 0
          || !!tokensTask.temporal;
      const typeTask = hasTokensTask
        ? tokensTask.temporal
          ? 'task'
          : 'note'
        : 'inbox';

      expect(typeTask).toBe('task');

      // Solo contexto sin fecha -> note
      const tokensNote = OmnibarParser.extractTokens(
        'Ideas para el blog #Marketing',
      );
      const hasTokensNote
        = tokensNote.entities.length > 0
          || tokensNote.contexts.length > 0
          || !!tokensNote.temporal;
      const typeNote = hasTokensNote
        ? tokensNote.temporal
          ? 'task'
          : 'note'
        : 'inbox';

      expect(typeNote).toBe('note');
    });
  });

  describe('Delimitadores por Sintagmas y Comas (Token Chunking)', () => {
    it('segmenta y clasifica bloques por comas (entidad, contacto, dirección, evento)', () => {
      const input
        = 'Carlos Garcia, telf 654887744, calle Camarles 23 , 1º 2ª de Tarragona , visita para reparar grifo que gotea el miercoles de la semana que viene';

      const chunks = OmnibarParser.extractSyntagmaChunks(input);

      expect(chunks).toHaveLength(4);

      // Bloque 1: Entidad (Carlos Garcia)
      expect(chunks[0]?.type).toBe('entity');
      expect(chunks[0]?.cleanText).toBe('Carlos Garcia');

      // Bloque 2: Contacto (telf 654887744)
      expect(chunks[1]?.type).toBe('contact');
      expect(chunks[1]?.cleanText).toBe('654887744');

      // Bloque 3: Dirección unificada con absorción de piso/puerta/ciudad
      expect(chunks[2]?.type).toBe('address');
      expect(chunks[2]?.cleanText).toBe(
        'calle Camarles 23, 1º 2ª de Tarragona',
      );

      // Bloque 4: Evento (visita para reparar...)
      expect(chunks[3]?.type).toBe('event');
      expect(chunks[3]?.cleanText).toContain('visita para reparar grifo que gotea');
    });

    it('procesa entrada molecular compuesta con cliente y evento simultáneos', () => {
      const input
        = 'Carlos Garcia, telf 654887744, calle Camarles 23 , 1º 2ª de Tarragona , visita para reparar grifo que gotea el miercoles de la semana que viene';

      const intent = OmnibarParser.parseToIntent(input, { referenceDate });

      // Arquetipo núcleo debe ser evento
      expect(intent.coreAtom.type).toBe('event');

      // El título debe ser el propósito limpio sin el resto de entidades ni fecha
      expect(intent.coreAtom.title).toBe('Visita para reparar grifo que gotea');

      // Fecha temporal detectada
      expect(intent.temporal).toBeDefined();
      expect(intent.temporal?.dueDate.getDate()).toBe(28);

      // Tokens y Sinapsis extraídas
      const assignedSynapse = intent.synapses.find(
        s => s.relationType === 'ASSIGNED_TO',
      );

      expect(assignedSynapse).toBeDefined();
      expect(assignedSynapse?.targetEntityName).toBe('Carlos Garcia');

      const phoneSynapse = intent.synapses.find(
        s => s.relationType === 'HAS_PHONE',
      );

      expect(phoneSynapse).toBeDefined();
      expect(phoneSynapse?.targetEntityName).toBe('654887744');

      const locSynapse = intent.synapses.find(
        s => s.relationType === 'AT_LOCATION',
      );

      expect(locSynapse).toBeDefined();
      expect(locSynapse?.targetEntityName).toContain('calle Camarles 23');
      expect(locSynapse?.targetEntityName).toContain('Tarragona');

      // Los sintagmas analizados deben quedar adjuntos en el payload
      expect(intent.coreAtom.payload.chunks).toBeDefined();
      expect(Array.isArray(intent.coreAtom.payload.chunks)).toBe(true);
    });

    it('clasifica bloques con otros delimitadores como punto y coma o salto de línea', () => {
      const input = 'Maria Lopez; email info@serveix.me; c/ Mayor 14; reunion de equipo';
      const chunks = OmnibarParser.extractSyntagmaChunks(input);

      expect(chunks).toHaveLength(4);
      expect(chunks[0]?.type).toBe('entity');
      expect(chunks[0]?.cleanText).toBe('Maria Lopez');
      expect(chunks[1]?.type).toBe('contact');
      expect(chunks[1]?.cleanText).toBe('info@serveix.me');
      expect(chunks[2]?.type).toBe('address');
      expect(chunks[3]?.type).toBe('event');
    });
  });

  describe('Detección Heurística de Nombres Propios (Sin diccionarios infinitos)', () => {
    it('Regla 1 (Gramatical): detecta nombres propios compuestos por mayúsculas consecutivas', () => {
      const input = 'Carlos Garcia necesita un presupuesto de fontaneria';
      const tokens = OmnibarParser.extractTokens(input);

      expect(tokens.entities).toHaveLength(1);
      expect(tokens.entities[0]?.name).toBe('Carlos Garcia');
    });

    it('Regla 2 (Posicional / Preposicional): detecta nombres simples o compuestos tras preposiciones con, a, para', () => {
      // Caso con: "Quedar con Carlos"
      const tokensCon = OmnibarParser.extractTokens(
        'Quedar con Carlos el 23/9 en la cafeteria',
        { referenceDate },
      );

      expect(tokensCon.entities).toHaveLength(1);
      expect(tokensCon.entities[0]?.name).toBe('Carlos');

      // Caso a: "Llamar a Pedro"
      const tokensA = OmnibarParser.extractTokens(
        'Llamar a Pedro mañana a las 10',
        { referenceDate },
      );

      expect(tokensA.entities).toHaveLength(1);
      expect(tokensA.entities[0]?.name).toBe('Pedro');

      // Caso para: "Enviar presupuesto para Maria"
      const tokensPara = OmnibarParser.extractTokens(
        'Enviar presupuesto para Maria',
        { referenceDate },
      );

      expect(tokensPara.entities).toHaveLength(1);
      expect(tokensPara.entities[0]?.name).toBe('Maria');
    });

    it('Regla 2 (Posicional inicial): detecta nombre propio simple al inicio de sintagma antes de coma', () => {
      const input = 'Carlos, telf 654887744, calle Camarles 23';
      const chunks = OmnibarParser.extractSyntagmaChunks(input);

      expect(chunks[0]?.type).toBe('entity');
      expect(chunks[0]?.cleanText).toBe('Carlos');

      const intent = OmnibarParser.parseToIntent(input, { referenceDate });

      expect(intent.coreAtom.type).toBe('client');
      expect(intent.coreAtom.title).toBe('Carlos');

      const phoneSynapse = intent.synapses.find(s => s.relationType === 'HAS_PHONE');

      expect(phoneSynapse).toBeDefined();
      expect(phoneSynapse?.targetEntityName).toBe('654887744');
    });

    it('Regla 3 (Exclusión de Stopwords): "Calle Camarles" no se interpreta como persona sino como dirección', () => {
      const input = 'Visitar Calle Camarles 23 mañana';
      const tokens = OmnibarParser.extractTokens(input, { referenceDate });

      const hasCalleEntity = tokens.entities.some(e =>
        e.name.toLowerCase().includes('calle') || e.name.toLowerCase().includes('camarles'),
      );

      expect(hasCalleEntity).toBe(false);
      expect(tokens.locations.length).toBeGreaterThanOrEqual(1);
      expect(tokens.locations[0]?.type).toBe('address');
    });

    it('Regla 3 (Exclusión de Días y Acciones): "Lunes" y "Revisión" no son interpretados como persona', () => {
      const input = 'Lunes reunión con Pedro';
      const tokens = OmnibarParser.extractTokens(input, { referenceDate });

      expect(tokens.entities).toHaveLength(1);
      expect(tokens.entities[0]?.name).toBe('Pedro');

      const names = tokens.entities.map(e => e.name.toLowerCase());

      expect(names).not.toContain('lunes');
      expect(names).not.toContain('reunión');
    });
  });

  describe('OmnibarReactor: Reactor de Enriquecimiento y Merge No Destructivo (Paso 3)', () => {
    const memberContext = {
      organizationId: 'org-test-reactor',
      userId: 'user-technician',
      role: 'member' as const,
    };

    const fullEventInput
      = 'Carlos Garcia, telf 654887744, calle Camarles 23 , 1º 2ª de Tarragona , visita para reparar grifo que gotea el miercoles de la semana que viene';

    it('Caso A (Cliente Existente): enriquece el cliente con nuevos datos sin sobreescribir y teje sinapsis bidireccionales con el evento', async () => {
      const existingClientAtom = {
        id: 'atom-client-carlos',
        organizationId: memberContext.organizationId,
        type: 'client',
        payload: {
          name: 'Carlos Garcia',
          phones: ['610000000'],
          locations: [],
        },
        metadata: { origin: 'legacy_import' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const resolveSpy = vi
        .spyOn(OmnibarReactor, 'resolveExistingIdentity')
        .mockResolvedValueOnce({
          clientAtom: existingClientAtom,
          isAmbiguous: false,
          candidateAtomIds: [],
          matchType: 'soft_unique',
          matchedValue: 'Carlos Garcia',
        });

      let updatedPayloadCaptured: any = null;
      let updatedMetadataCaptured: any = null;

      const updateSpy = vi
        .spyOn(AtomRepository, 'updateAtom')
        .mockImplementationOnce(async (_ctx, _id, input) => {
          updatedPayloadCaptured = input.payload;
          updatedMetadataCaptured = input.metadata;
          return {
            ...existingClientAtom,
            payload: input.payload ?? existingClientAtom.payload,
            metadata: input.metadata ?? existingClientAtom.metadata,
          };
        });

      let createdCoreAtomCaptured: any = null;
      const createdEventAtom = {
        id: 'atom-event-visita',
        organizationId: memberContext.organizationId,
        type: 'event',
        payload: {
          title: 'Visita para reparar grifo que gotea',
        },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createAtomSpy = vi
        .spyOn(AtomRepository, 'createAtom')
        .mockImplementationOnce(async (_ctx, input) => {
          createdCoreAtomCaptured = input;
          return {
            ...createdEventAtom,
            type: input.type,
            payload: input.payload,
            metadata: input.metadata ?? {},
          };
        });

      const findOrCreateSpy = vi
        .spyOn(OmnibarReactor, 'findOrCreateAtom')
        .mockImplementation(async (_ctx, type, name) => {
          return `atom-anchor-${type}-${name.replace(/\s+/g, '_')}`;
        });

      const createdSynapses: Array<{ source: string; target: string; type: string }> = [];
      const createSynapseSpy = vi
        .spyOn(SynapseRepository, 'createSynapse')
        .mockImplementation(async (_ctx, input) => {
          createdSynapses.push({
            source: input.sourceAtomId,
            target: input.targetAtomId,
            type: input.relationType,
          });
          return {
            id: `link-${createdSynapses.length}`,
            organizationId: memberContext.organizationId,
            sourceAtomId: input.sourceAtomId,
            targetAtomId: input.targetAtomId,
            relationType: input.relationType,
            metadata: input.metadata ?? {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        });

      const getMoleculeSpy = vi
        .spyOn(SynapseRepository, 'getMolecule')
        .mockResolvedValueOnce({
          root: createdEventAtom,
          outgoing: [],
          incoming: [],
          externalIdentities: [],
        });

      await OmnibarReactor.ingest(memberContext, fullEventInput, { referenceDate });

      // 1. El cliente existente fue enriquecido de manera NO destructiva (Set union de teléfonos)
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updatedPayloadCaptured).toBeDefined();
      expect(updatedPayloadCaptured?.phones).toEqual(['610000000', '654887744']);
      expect(
        (updatedPayloadCaptured?.locations as Array<{ normalized: string }>)[0]?.normalized,
      ).toContain('calle Camarles 23');
      expect(updatedMetadataCaptured?.enriched_by_event).toBe(true);

      // 2. El evento se creó con su tipo event y título limpio
      expect(createAtomSpy).toHaveBeenCalledTimes(1);
      expect(createdCoreAtomCaptured?.type).toBe('event');
      expect((createdCoreAtomCaptured?.payload as Record<string, unknown>).title).toBe(
        'Visita para reparar grifo que gotea',
      );

      // 3. Tejido de Sinapsis Químicas:
      // - Evento -> Cliente (ASSIGNED_TO)
      const assignedLink = createdSynapses.find(
        s => s.source === 'atom-event-visita' && s.target === 'atom-client-carlos' && s.type === 'ASSIGNED_TO',
      );

      expect(assignedLink).toBeDefined();

      // - Cliente -> Evento (RELATED_TO bidireccional)
      const relatedLink = createdSynapses.find(
        s => s.source === 'atom-client-carlos' && s.target === 'atom-event-visita' && s.type === 'RELATED_TO',
      );

      expect(relatedLink).toBeDefined();

      // - Cliente -> Teléfono (HAS_PHONE)
      const clientPhoneLink = createdSynapses.find(
        s => s.source === 'atom-client-carlos' && s.type === 'HAS_PHONE',
      );

      expect(clientPhoneLink).toBeDefined();

      // - Cliente -> Ubicación (AT_LOCATION)
      const clientLocLink = createdSynapses.find(
        s => s.source === 'atom-client-carlos' && s.type === 'AT_LOCATION',
      );

      expect(clientLocLink).toBeDefined();

      resolveSpy.mockRestore();
      updateSpy.mockRestore();
      createAtomSpy.mockRestore();
      findOrCreateSpy.mockRestore();
      createSynapseSpy.mockRestore();
      getMoleculeSpy.mockRestore();
    });

    it('Caso B (Cliente Nuevo): auto-sintetiza el cliente, genera el evento y teje la red molecular completa', async () => {
      const resolveSpy = vi
        .spyOn(OmnibarReactor, 'resolveExistingIdentity')
        .mockResolvedValueOnce({
          clientAtom: null,
          isAmbiguous: false,
          candidateAtomIds: [],
          matchType: 'none',
        });

      const createdAtoms: Array<{
        id: string;
        type: string;
        payload: Record<string, unknown>;
        metadata: Record<string, unknown>;
      }> = [];

      const createAtomSpy = vi
        .spyOn(AtomRepository, 'createAtom')
        .mockImplementation(async (_ctx, input) => {
          const id = input.type === 'client' ? 'atom-auto-client' : 'atom-auto-event';
          const atom = {
            id,
            organizationId: memberContext.organizationId,
            type: input.type,
            payload: input.payload,
            metadata: input.metadata ?? {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          createdAtoms.push(atom);
          return atom;
        });

      const findOrCreateSpy = vi
        .spyOn(OmnibarReactor, 'findOrCreateAtom')
        .mockImplementation(async (_ctx, type, name) => `atom-anchor-${type}-${name}`);

      const createdSynapses: Array<{ source: string; target: string; type: string }> = [];
      const createSynapseSpy = vi
        .spyOn(SynapseRepository, 'createSynapse')
        .mockImplementation(async (_ctx, input) => {
          createdSynapses.push({
            source: input.sourceAtomId,
            target: input.targetAtomId,
            type: input.relationType,
          });
          return {
            id: `link-${createdSynapses.length}`,
            organizationId: memberContext.organizationId,
            sourceAtomId: input.sourceAtomId,
            targetAtomId: input.targetAtomId,
            relationType: input.relationType,
            metadata: input.metadata ?? {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        });

      const getMoleculeSpy = vi
        .spyOn(SynapseRepository, 'getMolecule')
        .mockResolvedValueOnce({
          root: {
            id: 'atom-auto-event',
            organizationId: memberContext.organizationId,
            type: 'event',
            payload: {},
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          outgoing: [],
          incoming: [],
          externalIdentities: [],
        });

      await OmnibarReactor.ingest(memberContext, fullEventInput, { referenceDate });

      // Verificaciones:
      expect(createdAtoms).toHaveLength(2);

      const clientAtom = createdAtoms.find(a => a.type === 'client');

      expect(clientAtom).toBeDefined();
      expect(clientAtom?.payload.name).toBe('Carlos Garcia');
      expect(clientAtom?.payload.phones).toContain('654887744');
      expect(clientAtom?.metadata.provenance).toBe('omnibar_auto_synthesis');
      expect(clientAtom?.metadata.synthesized_from_event).toBe(true);

      const eventAtom = createdAtoms.find(a => a.type === 'event');

      expect(eventAtom).toBeDefined();
      expect(eventAtom?.payload.title).toBe('Visita para reparar grifo que gotea');

      const assigned = createdSynapses.find(
        s => s.source === 'atom-auto-event' && s.target === 'atom-auto-client' && s.type === 'ASSIGNED_TO',
      );

      expect(assigned).toBeDefined();

      const related = createdSynapses.find(
        s => s.source === 'atom-auto-client' && s.target === 'atom-auto-event' && s.type === 'RELATED_TO',
      );

      expect(related).toBeDefined();

      resolveSpy.mockRestore();
      createAtomSpy.mockRestore();
      findOrCreateSpy.mockRestore();
      createSynapseSpy.mockRestore();
      getMoleculeSpy.mockRestore();
    });

    it('Caso C (Ambigüedad de Homónimos): si hay múltiples coincidencias para el nombre, marca alerta sin auto-sintetizar duplicados', async () => {
      const resolveSpy = vi
        .spyOn(OmnibarReactor, 'resolveExistingIdentity')
        .mockResolvedValueOnce({
          clientAtom: null,
          isAmbiguous: true,
          candidateAtomIds: ['atom-carlos-padre', 'atom-carlos-hijo'],
          matchType: 'soft_ambiguous',
          matchedValue: 'Carlos Garcia',
        });

      let eventCreatedPayload: any = null;
      let eventCreatedMetadata: any = null;

      const createAtomSpy = vi
        .spyOn(AtomRepository, 'createAtom')
        .mockImplementation(async (_ctx, input) => {
          if (input.type === 'event') {
            eventCreatedPayload = input.payload;
            eventCreatedMetadata = input.metadata ?? null;
          }
          return {
            id: 'atom-ambiguous-event',
            organizationId: memberContext.organizationId,
            type: input.type,
            payload: input.payload,
            metadata: input.metadata ?? {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        });

      const findOrCreateSpy = vi
        .spyOn(OmnibarReactor, 'findOrCreateAtom')
        .mockImplementation(async (_ctx, type, name) => `atom-anchor-${type}-${name}`);

      const createSynapseSpy = vi
        .spyOn(SynapseRepository, 'createSynapse')
        .mockResolvedValue({
          id: 'link-mock',
          organizationId: memberContext.organizationId,
          sourceAtomId: 'atom-1',
          targetAtomId: 'atom-2',
          relationType: 'TEST',
          metadata: {},
          createdAt: new Date(),
        });

      const getMoleculeSpy = vi
        .spyOn(SynapseRepository, 'getMolecule')
        .mockResolvedValueOnce({
          root: {
            id: 'atom-ambiguous-event',
            organizationId: memberContext.organizationId,
            type: 'event',
            payload: {},
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          outgoing: [],
          incoming: [],
          externalIdentities: [],
        });

      await OmnibarReactor.ingest(memberContext, fullEventInput, { referenceDate });

      // No debe haberse creado un cliente duplicado (solo el átomo evento)
      expect(createAtomSpy).toHaveBeenCalledTimes(1);
      expect(eventCreatedPayload?.title).toBe('Visita para reparar grifo que gotea');

      const ambiguity = eventCreatedMetadata?.identity_ambiguity as {
        isAmbiguous: boolean;
        candidateAtomIds: string[];
      };

      expect(ambiguity).toBeDefined();
      expect(ambiguity.isAmbiguous).toBe(true);
      expect(ambiguity.candidateAtomIds).toEqual(['atom-carlos-padre', 'atom-carlos-hijo']);

      resolveSpy.mockRestore();
      createAtomSpy.mockRestore();
      findOrCreateSpy.mockRestore();
      createSynapseSpy.mockRestore();
      getMoleculeSpy.mockRestore();
    });
  });
});
