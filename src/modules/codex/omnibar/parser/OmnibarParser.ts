import type {
  IngestIntent,
  ParsedActionToken,
  ParsedActionType,
  ParsedConditionToken,
  ParsedContextToken,
  ParsedEmailToken,
  ParsedEntityToken,
  ParsedPhoneToken,
  ParsedTemporalToken,
  ParsedTokens,
} from '@/modules/codex/domain/types';
import * as chrono from 'chrono-node';
import { IngestIntentSchema } from '@/modules/codex/domain/types';

export type ParserOptions = {
  knownEntities?: Array<{ id: string; name: string }>;
  referenceDate?: Date;
  source?: IngestIntent['source'];
};

// Regex de Teléfonos: Internacional (+34..., 0034...) o Nacional Español (9 dígitos empezando por 6, 7, 8 o 9)
const PHONE_REGEX = /(?:\+|00)\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?)?(?:\d[\s.-]?){6,12}\d\b|\b[6-9](?:[\s.-]?\d){8}\b/g;

// Regex de Correos Electrónicos
const EMAIL_REGEX = /(?<!\w)[\w.%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

// Catálogo de Verbos de Acción Operativos en Español
const ACTION_DEFINITIONS: Array<{
  action: ParsedActionType;
  label: string;
  regex: RegExp;
}> = [
  {
    action: 'call',
    label: 'Llamada',
    regex: /\b(llamar|llama|llamada|telefonear|contactar|hablar con)\b/gi,
  },
  {
    action: 'visit',
    label: 'Visita',
    regex: /\b(visitar|visita|reunirse|reunión|reunion|quedar con|ir a|pasar por)\b/gi,
  },
  {
    action: 'review',
    label: 'Revisión',
    regex: /\b(revisar|revisa|revisión|revision|inspeccionar|inspección|inspeccion|comprobar|verificar|reparar|arreglar)\b/gi,
  },
  {
    action: 'send',
    label: 'Envío',
    regex: /\b(enviar|envía|envia|mandar|presupuestar|facturar|remitir)\b/gi,
  },
  {
    action: 'confirm',
    label: 'Confirmación',
    regex: /\b(confirmar|confirma|confirmación|confirmacion|validar)\b/gi,
  },
];

// Catálogo de Condicionantes / Incertidumbre
const CONDITION_REGEX = /\b(?:tal vez|quizás|quizas|por si acaso|por si|posiblemente|a confirmar|pendiente de\s+[\w\u00C0-\u017F]+|depende de\s+[\w\u00C0-\u017F]+|si\s+(?:no\s+)?[\w\u00C0-\u017F]+)\b/gi;

// Palabras clave requeridas para validar fechas en lenguaje natural sin prefijo //
const TEMPORAL_SPANISH_KEYWORDS = /\b(?:hoy|mañana|ayer|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|semana|mes|año|días|dias|horas?|minutos?|mediodía|mediodia|noche|tarde)\b/i;

// Palabras reservadas que no deben ser interpretadas como nombres propios
const STOPWORDS = new Set([
  'llamar',
  'llama',
  'llamada',
  'telefonear',
  'contactar',
  'visitar',
  'visita',
  'reunirse',
  'reunion',
  'reunión',
  'revisar',
  'revisa',
  'revision',
  'revisión',
  'inspeccionar',
  'comprobar',
  'verificar',
  'enviar',
  'envia',
  'envía',
  'mandar',
  'presupuestar',
  'facturar',
  'confirmar',
  'confirma',
  'confirmacion',
  'confirmación',
  'comprar',
  'hacer',
  'ir',
  'ver',
  'entregar',
  'pedir',
  'buscar',
  'arreglar',
  'reparar',
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'de',
  'del',
  'al',
  'en',
  'para',
  'por',
  'con',
  'sin',
  'sobre',
  'tras',
  'si',
  'no',
  'tal',
  'vez',
  'quizas',
  'quizás',
  'hoy',
  'mañana',
  'ayer',
  'ahora',
  'luego',
  'lunes',
  'martes',
  'miercoles',
  'miércoles',
  'jueves',
  'viernes',
  'sabado',
  'sábado',
  'domingo',
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
  'urgente',
  'importante',
  'nota',
  'tarea',
  'cita',
  'obra',
  'casa',
]);

function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.replace(/[\s().-]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }
  return cleaned;
}

export class OmnibarParser {
  /**
   * Extrae anclajes (teléfonos, correos, verbos, condiciones), tokens (@entidad, //fecha, #contexto)
   * y texto limpio del input del usuario.
   */
  static extractTokens(text: string, options: ParserOptions = {}): ParsedTokens {
    const rawText = text ?? '';
    const knownEntities = options.knownEntities ?? [];
    const refDate = options.referenceDate ?? new Date();

    const entities: ParsedEntityToken[] = [];
    const contexts: ParsedContextToken[] = [];
    const phones: ParsedPhoneToken[] = [];
    const emails: ParsedEmailToken[] = [];
    const actions: ParsedActionToken[] = [];
    const conditions: ParsedConditionToken[] = [];
    let temporal: ParsedTemporalToken | undefined;

    // Tokens a remover del texto limpio
    const rangesToRemove: Array<{ start: number; end: number }> = [];
    // Rangos protegidos para evitar que extractores posteriores colisionen
    const occupiedRanges: Array<{ start: number; end: number }> = [];

    // Helper para verificar si un rango colisiona con uno ya protegido
    const isOccupied = (start: number, end: number) =>
      occupiedRanges.some(r => Math.max(start, r.start) < Math.min(end, r.end));

    // 1. EXTRAER CORREOS ELECTRÓNICOS
    const emailMatches = Array.from(rawText.matchAll(EMAIL_REGEX));
    for (const match of emailMatches) {
      if (match.index === undefined) {
        continue;
      }
      const raw = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + raw.length;

      emails.push({
        raw,
        email: raw.toLowerCase(),
        startIndex,
        endIndex,
      });
      occupiedRanges.push({ start: startIndex, end: endIndex });
    }

    // 2. EXTRAER TELÉFONOS
    const phoneMatches = Array.from(rawText.matchAll(PHONE_REGEX));
    for (const match of phoneMatches) {
      if (match.index === undefined) {
        continue;
      }
      const raw = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + raw.length;

      if (!isOccupied(startIndex, endIndex)) {
        phones.push({
          raw,
          number: normalizePhoneNumber(raw),
          startIndex,
          endIndex,
        });
        occupiedRanges.push({ start: startIndex, end: endIndex });
      }
    }

    // 3. EXTRAER TEMPORAL EXPLÍCITO (//...)
    const temporalRegex = /\/\/([^\s#@][^#@]*)/g;
    const temporalMatches = Array.from(rawText.matchAll(temporalRegex));

    for (const tempMatch of temporalMatches) {
      if (tempMatch.index === undefined) {
        continue;
      }
      const expression = tempMatch[1]?.trim() ?? '';
      const startIndex = tempMatch.index;

      if (expression.length > 0) {
        const parsedResults = chrono.es.parse(expression, refDate);

        if (parsedResults.length > 0 && parsedResults[0]) {
          const firstResult = parsedResults[0];
          const date = firstResult.date();
          const hasTime = firstResult.start.isCertain('hour');

          const exactEndIndex = startIndex + 2 + firstResult.index + firstResult.text.length;
          const exactRaw = rawText.slice(startIndex, exactEndIndex);

          temporal = {
            raw: exactRaw,
            expression: firstResult.text,
            date,
            hasTime,
            startIndex,
            endIndex: exactEndIndex,
          };

          rangesToRemove.push({ start: startIndex, end: exactEndIndex });
          occupiedRanges.push({ start: startIndex, end: exactEndIndex });
          break;
        }
      }
    }

    // 4. EXTRAER CONTEXTOS (#...)
    const contextRegex = /#([\w\-\u00C0-\u017F]+)/g;
    const contextMatches = Array.from(rawText.matchAll(contextRegex));

    for (const ctxMatch of contextMatches) {
      if (ctxMatch.index === undefined) {
        continue;
      }
      const fullMatch = ctxMatch[0];
      const name = ctxMatch[1] ?? '';
      const startIndex = ctxMatch.index;
      const endIndex = startIndex + fullMatch.length;

      if (!isOccupied(startIndex, endIndex) && name.length > 0) {
        contexts.push({
          raw: fullMatch,
          name,
          startIndex,
          endIndex,
        });
        rangesToRemove.push({ start: startIndex, end: endIndex });
        occupiedRanges.push({ start: startIndex, end: endIndex });
      }
    }

    // 5. EXTRAER ENTIDADES EXPLÍCITAS (@...)
    const sortedKnown = [...knownEntities].sort(
      (a, b) => b.name.length - a.name.length,
    );

    const atIndices: number[] = [];
    for (let i = 0; i < rawText.length; i++) {
      if (rawText[i] === '@') {
        atIndices.push(i);
      }
    }

    for (const atIndex of atIndices) {
      if (isOccupied(atIndex, atIndex + 1)) {
        continue;
      }

      const substringAfterAt = rawText.slice(atIndex + 1);

      // A) Coincidencia con entidad conocida (Greedy)
      let matchedKnown: { id: string; name: string } | null = null;
      for (const known of sortedKnown) {
        if (
          substringAfterAt.toLowerCase().startsWith(known.name.toLowerCase())
        ) {
          const charAfter = substringAfterAt[known.name.length];
          if (!charAfter || /[\s,.:;!?#/]/.test(charAfter)) {
            matchedKnown = known;
            break;
          }
        }
      }

      if (matchedKnown) {
        const rawToken = `@${substringAfterAt.slice(0, matchedKnown.name.length)}`;
        const startIndex = atIndex;
        const endIndex = atIndex + rawToken.length;

        entities.push({
          raw: rawToken,
          name: matchedKnown.name,
          matchedAtomId: matchedKnown.id,
          startIndex,
          endIndex,
        });
        rangesToRemove.push({ start: startIndex, end: endIndex });
        occupiedRanges.push({ start: startIndex, end: endIndex });
        continue;
      }

      // B) Entidad desconocida / dinámica con @
      const dynamicMatch = substringAfterAt.match(
        /^([A-Z\u00C0-\u017F][\w\-\u00C0-\u017F]*(?:\s+[A-Z\u00C0-\u017F][\w\-\u00C0-\u017F]*)*|[^\s,.:;!?#/]+)/,
      );

      if (dynamicMatch && dynamicMatch[0]) {
        const entityName = dynamicMatch[0].trim();
        const rawToken = `@${entityName}`;
        const startIndex = atIndex;
        const endIndex = atIndex + rawToken.length;

        entities.push({
          raw: rawToken,
          name: entityName,
          startIndex,
          endIndex,
        });
        rangesToRemove.push({ start: startIndex, end: endIndex });
        occupiedRanges.push({ start: startIndex, end: endIndex });
      }
    }

    // 6. EXTRAER FECHAS EN LENGUAJE NATURAL SIN PREFIJO // (Fallback Inteligente)
    if (!temporal) {
      // Enmascarar teléfonos, correos y contextos con espacios para que chrono no altere los índices
      let maskedText = rawText;
      for (const r of occupiedRanges) {
        const span = r.end - r.start;
        maskedText
          = maskedText.slice(0, r.start) + ' '.repeat(span) + maskedText.slice(r.end);
      }

      const parsedResults = chrono.es.parse(maskedText, refDate);
      if (parsedResults.length > 0 && parsedResults[0]) {
        const firstResult = parsedResults[0];
        const isLegitDate
          = firstResult.start.isCertain('weekday')
            || firstResult.start.isCertain('day')
            || firstResult.start.isCertain('month')
            || firstResult.start.isCertain('hour')
            || TEMPORAL_SPANISH_KEYWORDS.test(firstResult.text);

        if (isLegitDate) {
          let dateStartIndex = firstResult.index;
          // Absorber preposiciones precedentes (ej. "el ", "para el ")
          const textBefore = rawText.slice(0, dateStartIndex);
          const prepMatch = textBefore.match(/(?:para\s+el|el\s+próximo|el\s+proximo|el|este|en)\s+$/i);
          if (prepMatch) {
            dateStartIndex -= prepMatch[0].length;
          }

          const dateEndIndex = firstResult.index + firstResult.text.length;
          const exactRaw = rawText.slice(dateStartIndex, dateEndIndex);

          temporal = {
            raw: exactRaw,
            expression: firstResult.text,
            date: firstResult.date(),
            hasTime: firstResult.start.isCertain('hour'),
            startIndex: dateStartIndex,
            endIndex: dateEndIndex,
          };

          rangesToRemove.push({ start: dateStartIndex, end: dateEndIndex });
          occupiedRanges.push({ start: dateStartIndex, end: dateEndIndex });
        }
      }
    }

    // 7. EXTRAER VERBOS DE ACCIÓN OPERATIVOS
    for (const def of ACTION_DEFINITIONS) {
      const matches = Array.from(rawText.matchAll(def.regex));
      for (const m of matches) {
        if (m.index === undefined) {
          continue;
        }
        const startIndex = m.index;
        const endIndex = startIndex + m[0].length;

        if (!isOccupied(startIndex, endIndex)) {
          actions.push({
            raw: m[0],
            action: def.action,
            label: def.label,
            startIndex,
            endIndex,
          });
        }
      }
    }

    // 8. EXTRAER CONDICIONANTES / INCERTIDUMBRE
    const condMatches = Array.from(rawText.matchAll(CONDITION_REGEX));
    for (const m of condMatches) {
      if (m.index === undefined) {
        continue;
      }
      const startIndex = m.index;
      const endIndex = startIndex + m[0].length;

      if (!isOccupied(startIndex, endIndex)) {
        conditions.push({
          raw: m[0],
          expression: m[0].trim(),
          startIndex,
          endIndex,
        });
      }
    }

    // 9. EXTRAER NOMBRES PROPIOS IMPLÍCITOS (Sin @)
    // A) Entidades conocidas presentes en el texto
    for (const known of sortedKnown) {
      const knownRegex = new RegExp(`\\b${known.name}\\b`, 'gi');
      const kMatches = Array.from(rawText.matchAll(knownRegex));
      for (const km of kMatches) {
        if (km.index === undefined) {
          continue;
        }
        const startIndex = km.index;
        const endIndex = startIndex + km[0].length;

        const alreadyAdded = entities.some(
          e => Math.max(startIndex, e.startIndex) < Math.min(endIndex, e.endIndex),
        );
        if (!alreadyAdded && !isOccupied(startIndex, endIndex)) {
          entities.push({
            raw: km[0],
            name: known.name,
            matchedAtomId: known.id,
            startIndex,
            endIndex,
          });
          occupiedRanges.push({ start: startIndex, end: endIndex });
        }
      }
    }

    // B) Nombres propios compuestos por 2 o más palabras en mayúscula (ej. Jose Martines, Juan Carrasco)
    const properNameRegex = /\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+\b/g;
    const nameMatches = Array.from(rawText.matchAll(properNameRegex));
    for (const nm of nameMatches) {
      if (nm.index === undefined) {
        continue;
      }
      const startIndex = nm.index;
      const endIndex = startIndex + nm[0].length;

      const words = nm[0].toLowerCase().split(/\s+/);
      const containsStopword = words.some(w => STOPWORDS.has(w));

      const alreadyAdded = entities.some(
        e => Math.max(startIndex, e.startIndex) < Math.min(endIndex, e.endIndex),
      );

      if (!containsStopword && !alreadyAdded && !isOccupied(startIndex, endIndex)) {
        entities.push({
          raw: nm[0],
          name: nm[0].trim(),
          startIndex,
          endIndex,
        });
        occupiedRanges.push({ start: startIndex, end: endIndex });
      }
    }

    // 10. GENERAR TEXTO LIMPIO (Removiendo rangos sintácticos explícitos)
    const sortedRanges = [...rangesToRemove].sort((a, b) => b.start - a.start);
    let cleanText = rawText;

    for (const range of sortedRanges) {
      cleanText = cleanText.slice(0, range.start) + cleanText.slice(range.end);
    }

    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return {
      entities,
      contexts,
      temporal,
      phones,
      emails,
      actions,
      conditions,
      cleanText,
    };
  }

  /**
   * Transforma el texto de entrada en un IngestIntent universal enriquecido.
   */
  static parseToIntent(
    text: string,
    options: ParserOptions = {},
  ): IngestIntent {
    const tokens = this.extractTokens(text, options);

    const isOperative = tokens.actions.length > 0 || !!tokens.temporal;
    const hasContactAnchor = tokens.phones.length > 0 || tokens.emails.length > 0;
    const hasEntity = tokens.entities.length > 0;
    const hasContext = tokens.contexts.length > 0;

    // Regla Biológica de Arquetipos de Átomo:
    // 1. Si hay acción operativa o temporal -> 'task'
    // 2. Si hay entidad + anclaje de contacto (tel/email) sin acción ni fecha -> 'client' (Ficha emergente)
    // 3. Si hay entidad o contexto sin acción -> 'note'
    // 4. Si no hay anclajes -> 'inbox'
    let coreType = 'inbox';
    let title = tokens.cleanText.length > 0 ? tokens.cleanText : text.trim();

    if (isOperative) {
      coreType = 'task';
    } else if (hasContactAnchor && hasEntity) {
      coreType = 'client';
      const mainEntity = tokens.entities[0];
      if (mainEntity) {
        title = mainEntity.name;
      }
    } else if (hasEntity || hasContext) {
      coreType = 'note';
    }

    // Generar Sinapsis de Relaciones
    const synapses: IngestIntent['synapses'] = [];

    // Sinapsis de Entidades (@ o detectadas) -> ASSIGNED_TO
    for (const entity of tokens.entities) {
      synapses.push({
        relationType: 'ASSIGNED_TO',
        targetEntityName: entity.name,
        targetAtomId: entity.matchedAtomId,
        targetType: 'entity',
        metadata: { rawToken: entity.raw },
      });
    }

    // Sinapsis de Contextos (#) -> TAGGED_WITH
    for (const context of tokens.contexts) {
      synapses.push({
        relationType: 'TAGGED_WITH',
        targetEntityName: context.name,
        targetType: 'context',
        metadata: { rawToken: context.raw },
      });
    }

    // Sinapsis de Anclaje Telefónico -> HAS_PHONE
    for (const phone of tokens.phones) {
      synapses.push({
        relationType: 'HAS_PHONE',
        targetEntityName: phone.number,
        targetType: 'anchor_phone',
        metadata: { raw: phone.raw, number: phone.number },
      });
    }

    // Sinapsis de Anclaje Email -> HAS_EMAIL
    for (const email of tokens.emails) {
      synapses.push({
        relationType: 'HAS_EMAIL',
        targetEntityName: email.email,
        targetType: 'anchor_email',
        metadata: { raw: email.raw, email: email.email },
      });
    }

    // Temporal
    const temporalData = tokens.temporal
      ? {
          rawExpression: tokens.temporal.expression,
          dueDate: tokens.temporal.date,
          hasTime: tokens.temporal.hasTime,
        }
      : undefined;

    return IngestIntentSchema.parse({
      rawText: text,
      source: options.source ?? 'omnibar_regex',
      coreAtom: {
        type: coreType,
        title,
        payload: {
          raw: text,
          phones: tokens.phones.map(p => p.number),
          emails: tokens.emails.map(e => e.email),
          actions: tokens.actions.map(a => a.action),
          conditions: tokens.conditions.map(c => c.expression),
          isTentative: tokens.conditions.length > 0,
        },
      },
      synapses,
      temporal: temporalData,
    });
  }
}
