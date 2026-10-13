import type {
  IngestIntent,
  ParsedActionToken,
  ParsedActionType,
  ParsedConditionToken,
  ParsedContextToken,
  ParsedDocumentToken,
  ParsedDocumentType,
  ParsedEmailToken,
  ParsedEntityToken,
  ParsedLocationToken,
  ParsedPhoneToken,
  ParsedSyntagmaChunk,
  ParsedTemporalToken,
  ParsedTokens,
  SyntagmaChunkType,
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

// Regex de Identificadores Fiscales Españoles (DNI, NIE, CIF)
const DOCUMENT_REGEX = /\b(?:\d{8}[-\s]?[A-Z]|[XYZ][-\s]?\d{7}[-\s]?[A-Z]|[A-HJNP-SUVW][-\s]?\d{7}[-\s]?[0-9A-J])\b/gi;

// Regex de Coordenadas GPS (Latitud, Longitud decimales)
const GPS_REGEX = /(?<![\w/])([-+]?(?:[1-8]?\d\.\d+|90(?:\.0+)?))\s*,\s*([-+]?(?:180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})\.\d+))(?![\w/])/g;

// Regex de Google Maps Plus Codes (Open Location Code) con localidad opcional (ej: 8FX28399+Q2 o 8399+Q2 Tortosa)
const PLUS_CODE_REGEX = /\b([2-9CFGHJMPQRVWXcfghjmpqrvwx]{4,8}\+[2-9CFGHJMPQRVWXcfghjmpqrvwx]{2,3})(?:\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*))?\b/g;

// Regex de Direcciones viales en español
const ADDRESS_REGEX = /\b(?:c\/|calle|avda\.?|avenida|pza\.?|plaza|paseo|ps\.?|ctra\.?|carretera|pol[íi]gono|travessera|traves[íi]a|rambla|camino|v[íi]a)\s[A-ZÁÉÍÓÚÑ0-9.,\s'-]+?\b(?:\d{1,5}(?:\s*(?:bis|[ºªa-z]))?|nave\s*\d+|km\s*\d+)(?:\s*(?:,\s*)?(?:cp\s*)?\b\d{5}\b)?(?:\s*(?:,\s*)?[a-záéíóúñ]{2,})?(?=\s+(?:el|la|los|para|con|por|de|en|[a#@]|\/\/|$|\.\s)|$)/gi;

// Patrones de Sintagmas y Delimitadores (Token Chunking)
const CHUNK_DELIMITER_REGEX = /[,;|]|\n+/g;
const PHONE_PATTERN = /(?:\+|00)\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?)?(?:\d[\s.-]?){6,12}\d\b|\b[6-9](?:[\s.-]?\d){8}\b/;
const EMAIL_PATTERN = /(?<!\w)[\w.%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ADDRESS_PREFIX_PATTERN = /^\s*(?:en\s+)?(?:c\/|(?:calle|avda\.?|avenida|pza\.?|plaza|paseo|ps\.?|ctra\.?|carretera|pol[íi]gono|travessera|traves[íi]a|rambla|camino|v[íi]a)\b)/i;
const ADDRESS_CONTINUATION_PATTERN = /^\s*(?:\d+\s*[ºª]|piso\b|puerta\b|pta\.?\b|escalera\b|esc\.?\b|bajo\b|[aá]tico\b|sobre[aá]tico\b|nave\s*\d+\b|bloque\s*\d+\b|km\s*\d+\b|cp\s*\d{5}\b|\d{5}\b|de\s+[A-ZÁÉÍÓÚÑ]+)/i;
const EVENT_KEYWORDS_PATTERN = /\b(?:visita|visitar|reuni[óo]n|reunirse|cita|quedar con|encuentro|sesi[óo]n|entrevista)\b/i;
const TASK_KEYWORDS_PATTERN = /\b(?:llamar|revisar|revisa|inspeccionar|comprobar|verificar|reparar|arreglar|enviar|mandar|presupuestar|facturar|confirmar|comprar|hacer|instalar|tarea)\b/i;
const CONTACT_PREFIX_PATTERN = /^\s*(?:telf?\.?|tel[ée]fono|m[óo]vil|celular|phone|correo|email|mail|dni|nie|cif|nif)[:\s]*/i;
const GPS_PATTERN = /(?<![\w/])[-+]?(?:[1-8]?\d\.\d+|90(?:\.0+)?)\s*,\s*[-+]?(?:180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})\.\d+)(?![\w/])/;
const PLUS_CODE_PATTERN = /\b[2-9CFGHJMPQRVWX]{4,8}\+[2-9CFGHJMPQRVWX]{2,3}(?:\s+[A-ZÁÉÍÓÚÑ]+)*\b/i;

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

/**
 * Validador algorítmico oficial para documentos de identidad fiscal en España (DNI, NIE, CIF).
 */
function validateSpanishDocument(raw: string): {
  isValid: boolean;
  type: ParsedDocumentType;
  normalized: string;
} | null {
  const cleaned = raw.toUpperCase().replace(/[\s-]/g, '');

  // 1. DNI: 8 dígitos + 1 letra
  const dniMatch = cleaned.match(/^(\d{8})([A-Z])$/);
  if (dniMatch && dniMatch[1] && dniMatch[2]) {
    const num = Number.parseInt(dniMatch[1], 10);
    const letter = dniMatch[2];
    const expectedLetter = DNI_LETTERS[num % 23];
    return {
      isValid: letter === expectedLetter,
      type: 'dni',
      normalized: cleaned,
    };
  }

  // 2. NIE: X, Y o Z + 7 dígitos + 1 letra
  const nieMatch = cleaned.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (nieMatch && nieMatch[1] && nieMatch[2] && nieMatch[3]) {
    const prefixLetter = nieMatch[1];
    const numPart = nieMatch[2];
    const letter = nieMatch[3];
    const prefixDigit = prefixLetter === 'X' ? '0' : prefixLetter === 'Y' ? '1' : '2';
    const fullNum = Number.parseInt(`${prefixDigit}${numPart}`, 10);
    const expectedLetter = DNI_LETTERS[fullNum % 23];
    return {
      isValid: letter === expectedLetter,
      type: 'nie',
      normalized: cleaned,
    };
  }

  // 3. CIF: 1 letra (ABCDEFGHJNPQRSUVW) + 7 dígitos + 1 carácter de control (dígito o letra)
  const cifMatch = cleaned.match(/^([A-HJNP-SUVW])(\d{7})([0-9A-J])$/);
  if (cifMatch && cifMatch[1] && cifMatch[2] && cifMatch[3]) {
    const letter = cifMatch[1];
    const digits = cifMatch[2];
    const control = cifMatch[3];

    // Posiciones pares (índices 1, 3, 5)
    let sumEven = 0;
    for (let i = 1; i < 7; i += 2) {
      sumEven += Number.parseInt(digits[i]!, 10);
    }

    // Posiciones impares (índices 0, 2, 4, 6)
    let sumOdd = 0;
    for (let i = 0; i < 7; i += 2) {
      const doubled = Number.parseInt(digits[i]!, 10) * 2;
      sumOdd += doubled >= 10 ? doubled - 9 : doubled;
    }

    const sumTotal = sumEven + sumOdd;
    const lastDigit = sumTotal % 10;
    const expectedDigit = lastDigit === 0 ? 0 : 10 - lastDigit;
    const expectedLetter = 'JABCDEFGHI'[expectedDigit];

    let isValid = false;
    if (['A', 'B', 'E', 'H'].includes(letter)) {
      isValid = control === String(expectedDigit);
    } else if (['P', 'Q', 'S', 'R', 'W'].includes(letter)) {
      isValid = control === expectedLetter;
    } else {
      isValid = control === String(expectedDigit) || control === expectedLetter;
    }

    return {
      isValid,
      type: 'cif',
      normalized: cleaned,
    };
  }

  return null;
}

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
  // Prefijos y componentes viales (Regla 3: Exclusión de viales como persona)
  'calle',
  'c/',
  'avda',
  'avenida',
  'paseo',
  'ps',
  'plaza',
  'pza',
  'carretera',
  'ctra',
  'poligono',
  'polígono',
  'rambla',
  'camino',
  'via',
  'vía',
  'travessera',
  'travesia',
  'travesía',
  'edificio',
  'bloque',
  'nave',
  'piso',
  'puerta',
  'escalera',
  'portal',
  // Sustantivos documentales u operativos
  'factura',
  'presupuesto',
  'albaran',
  'albarán',
  'pedido',
  'informe',
  'recibo',
  'cliente',
  'proveedor',
  'empresa',
  'proyecto',
  'encuentro',
  'sesion',
  'sesión',
  'entrevista',
]);

function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.replace(/[\s().-]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }
  return cleaned;
}

export class OmnibarParser {
  static validateSpanishDocument = validateSpanishDocument;

  /**
   * Segmenta el input en sintagmas (chunks) delimitados por comas, puntos y comas o saltos de línea,
   * absorbe sufijos y modificadores de dirección contiguos y clasifica semánticamente cada bloque.
   */
  static extractSyntagmaChunks(
    text: string,
    options: ParserOptions = {},
  ): ParsedSyntagmaChunk[] {
    const rawText = text ?? '';
    if (rawText.trim().length === 0) {
      return [];
    }

    // 1. Delimitar segmentos brutos preservando índices de inicio y fin
    const segments: Array<{ raw: string; startIndex: number; endIndex: number }> = [];
    let lastIndex = 0;
    const delimRegex = new RegExp(CHUNK_DELIMITER_REGEX.source, 'g');
    let match = delimRegex.exec(rawText);
    while (match !== null) {
      const rawSegment = rawText.slice(lastIndex, match.index);
      if (rawSegment.trim().length > 0) {
        const leadingSpaces = rawSegment.length - rawSegment.trimStart().length;
        const trailingSpaces = rawSegment.length - rawSegment.trimEnd().length;
        segments.push({
          raw: rawSegment.trim(),
          startIndex: lastIndex + leadingSpaces,
          endIndex: match.index - trailingSpaces,
        });
      }
      lastIndex = delimRegex.lastIndex;
      match = delimRegex.exec(rawText);
    }

    if (lastIndex < rawText.length) {
      const rawSegment = rawText.slice(lastIndex);
      if (rawSegment.trim().length > 0) {
        const leadingSpaces = rawSegment.length - rawSegment.trimStart().length;
        const trailingSpaces = rawSegment.length - rawSegment.trimEnd().length;
        segments.push({
          raw: rawSegment.trim(),
          startIndex: lastIndex + leadingSpaces,
          endIndex: rawText.length - trailingSpaces,
        });
      }
    }

    if (segments.length === 0) {
      return [];
    }

    // 2. Absorción de complementos de dirección (ej: "calle Camarles 23" + "1º 2ª de Tarragona")
    const mergedSegments: Array<{ raw: string; startIndex: number; endIndex: number }> = [];

    for (let i = 0; i < segments.length; i++) {
      const curr = segments[i]!;

      if (ADDRESS_PREFIX_PATTERN.test(curr.raw)) {
        let combinedRaw = curr.raw;
        let combinedEndIndex = curr.endIndex;

        while (i + 1 < segments.length) {
          const next = segments[i + 1]!;
          const isNextContact
            = CONTACT_PREFIX_PATTERN.test(next.raw) || PHONE_PATTERN.test(next.raw);
          const isNextEvent = EVENT_KEYWORDS_PATTERN.test(next.raw);
          const isNextAt = next.raw.startsWith('@');

          if (
            !isNextContact
            && !isNextEvent
            && !isNextAt
            && ADDRESS_CONTINUATION_PATTERN.test(next.raw)
          ) {
            combinedRaw = `${combinedRaw}, ${next.raw}`;
            combinedEndIndex = next.endIndex;
            i++;
          } else {
            break;
          }
        }

        mergedSegments.push({
          raw: combinedRaw,
          startIndex: curr.startIndex,
          endIndex: combinedEndIndex,
        });
      } else {
        mergedSegments.push(curr);
      }
    }

    // 3. Clasificación de cada sintagma
    const chunks: ParsedSyntagmaChunk[] = [];
    const knownEntities = options.knownEntities ?? [];

    for (const seg of mergedSegments) {
      const trimmed = seg.raw.trim();
      let type: SyntagmaChunkType = 'general';
      let clean = trimmed;

      const hasPhone = PHONE_PATTERN.test(trimmed);
      const hasEmail = EMAIL_PATTERN.test(trimmed);
      const hasDoc = validateSpanishDocument(trimmed) !== null;
      const hasContactPrefix = CONTACT_PREFIX_PATTERN.test(trimmed);

      // A) CONTACTO: Teléfono, email, documento o prefijo explícito de contacto
      if (hasPhone || hasEmail || hasDoc || hasContactPrefix) {
        type = 'contact';
        clean = trimmed.replace(CONTACT_PREFIX_PATTERN, '').trim();
      } else if (
        ADDRESS_PREFIX_PATTERN.test(trimmed)
        || GPS_PATTERN.test(trimmed)
        || PLUS_CODE_PATTERN.test(trimmed)
      ) {
        // B) DIRECCIÓN: Prefijo vial, coordenadas o Plus Codes
        type = 'address';
        clean = trimmed.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim();
      } else if (EVENT_KEYWORDS_PATTERN.test(trimmed)) {
        // C) EVENTO: Verbos de visita, reunión, cita, etc.
        type = 'event';
        clean = trimmed;
      } else if (TASK_KEYWORDS_PATTERN.test(trimmed)) {
        // D) TAREA: Verbos de acción operativa pero no de reunión
        type = 'task';
        clean = trimmed;
      } else if (
        trimmed.startsWith('@')
        || knownEntities.some(k => k.name.toLowerCase() === trimmed.toLowerCase())
        || /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+$/.test(trimmed)
        || (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(trimmed) && (seg.startIndex === 0 || segments.length > 1))
        || /^(?:[Cc]on|[Aa]|[Pp]ara|[Dd]e)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*$/.test(trimmed)
      ) {
        // E) ENTIDAD: Nombres propios con @, Mayúsculas compuestas, o posición inicial / preposición
        const stripped = trimmed.replace(/^@/, '').replace(/^(?:con|a|para|de)\s+/i, '').trim();
        const words = stripped.toLowerCase().split(/\s+/);
        const containsStopword = words.some(w => STOPWORDS.has(w));
        if (!containsStopword && words.length > 0) {
          type = 'entity';
          clean = stripped;
        }
      }

      chunks.push({
        type,
        raw: trimmed,
        cleanText: clean,
        startIndex: seg.startIndex,
        endIndex: seg.endIndex,
      });
    }

    return chunks;
  }

  /**
   * Extrae anclajes (teléfonos, correos, verbos, condiciones), tokens (@entidad, //fecha, #contexto)
   * y texto limpio del input del usuario.
   */
  static extractTokens(text: string, options: ParserOptions = {}): ParsedTokens {
    const rawText = text ?? '';
    const knownEntities = options.knownEntities ?? [];
    const refDate = options.referenceDate ?? new Date();

    const chunks = this.extractSyntagmaChunks(rawText, options);

    const entities: ParsedEntityToken[] = [];
    const contexts: ParsedContextToken[] = [];
    const phones: ParsedPhoneToken[] = [];
    const emails: ParsedEmailToken[] = [];
    const documents: ParsedDocumentToken[] = [];
    const locations: ParsedLocationToken[] = [];
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

    // 2. EXTRAER IDENTIFICADORES FISCALES ESPAÑOLES (DNI, NIE, CIF)
    const docMatches = Array.from(rawText.matchAll(DOCUMENT_REGEX));
    for (const match of docMatches) {
      if (match.index === undefined) {
        continue;
      }
      const raw = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + raw.length;

      if (!isOccupied(startIndex, endIndex)) {
        const validated = validateSpanishDocument(raw);
        if (validated) {
          documents.push({
            raw,
            documentNumber: validated.normalized,
            type: validated.type,
            isValid: validated.isValid,
            startIndex,
            endIndex,
          });
          occupiedRanges.push({ start: startIndex, end: endIndex });
        }
      }
    }

    // 3. EXTRAER TELÉFONOS
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

    // 4. EXTRAER COORDENADAS GPS (Latitud, Longitud)
    const gpsMatches = Array.from(rawText.matchAll(GPS_REGEX));
    for (const match of gpsMatches) {
      if (match.index === undefined || !match[1] || !match[2]) {
        continue;
      }
      const raw = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + raw.length;

      if (!isOccupied(startIndex, endIndex)) {
        const lat = Number.parseFloat(match[1]);
        const lng = Number.parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          locations.push({
            raw,
            type: 'coordinates',
            normalized: `${lat}, ${lng}`,
            coordinates: { lat, lng },
            startIndex,
            endIndex,
          });
          occupiedRanges.push({ start: startIndex, end: endIndex });
        }
      }
    }

    // 5. EXTRAER GOOGLE MAPS PLUS CODES
    const plusMatches = Array.from(rawText.matchAll(PLUS_CODE_REGEX));
    for (const match of plusMatches) {
      if (match.index === undefined || !match[1]) {
        continue;
      }
      const raw = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + raw.length;

      if (!isOccupied(startIndex, endIndex)) {
        const code = match[1].toUpperCase();
        const city = match[2]?.trim();
        locations.push({
          raw,
          type: 'plus_code',
          normalized: city ? `${code} ${city}` : code,
          startIndex,
          endIndex,
        });
        occupiedRanges.push({ start: startIndex, end: endIndex });
      }
    }

    // 6a. EXTRAER DIRECCIONES DESDE SINTAGMAS ABSORBIDOS (CHUNKS)
    for (const chunk of chunks) {
      if (chunk.type === 'address' && !isOccupied(chunk.startIndex, chunk.endIndex)) {
        locations.push({
          raw: chunk.raw,
          type: 'address',
          normalized: chunk.cleanText,
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
        });
        occupiedRanges.push({ start: chunk.startIndex, end: chunk.endIndex });
      }
    }

    // 6b. EXTRAER DIRECCIONES VIALES EN ESPAÑOL (Fallback Regex)
    const addressMatches = Array.from(rawText.matchAll(ADDRESS_REGEX));
    for (const match of addressMatches) {
      if (match.index === undefined) {
        continue;
      }
      const raw = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + raw.length;

      if (!isOccupied(startIndex, endIndex)) {
        locations.push({
          raw,
          type: 'address',
          normalized: raw.trim().replace(/\s+/g, ' '),
          startIndex,
          endIndex,
        });
        occupiedRanges.push({ start: startIndex, end: endIndex });
      }
    }

    // 7. EXTRAER TEMPORAL EXPLÍCITO (//...)
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

          let dateEndIndex = firstResult.index + firstResult.text.length;
          // Absorber sufijos temporales en español (ej. "de la semana que viene", "que viene", "por la tarde", etc.)
          const textAfter = rawText.slice(dateEndIndex);
          const suffixMatch = textAfter.match(
            /^\s+(?:de\s+la\s+semana\s+que\s+viene|de\s+la\s+próxima\s+semana|de\s+la\s+proxima\s+semana|que\s+viene|próximo|proximo|del\s+mes\s+que\s+viene|por\s+la\s+mañana|por\s+la\s+tarde|por\s+la\s+noche)\b/i,
          );
          if (suffixMatch) {
            dateEndIndex += suffixMatch[0].length;
          }

          let finalDate = firstResult.date();
          if (
            suffixMatch
            && /semana\s+que\s+viene|próxima\s+semana|proxima\s+semana/i.test(suffixMatch[0])
          ) {
            // Si la fecha original calculada cae dentro de la semana en curso (menos de 7 días), sumar 7 días
            const diffDays = Math.round(
              (finalDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            if (diffDays <= 7) {
              finalDate = new Date(finalDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            }
          }

          const exactRaw = rawText.slice(dateStartIndex, dateEndIndex);
          const exactExpr = rawText.slice(firstResult.index, dateEndIndex).trim();

          temporal = {
            raw: exactRaw,
            expression: exactExpr,
            date: finalDate,
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

    // B1) Regla 2 (Posicional / Preposicional): Nombres precedidos por preposiciones de interacción ("con", "a", "para", "de")
    // Permite detectar nombres simples (ej. "con Carlos", "a Pedro", "para Maria") o compuestos
    const prepEntityRegex = /\b(?:[Cc]on|[Aa]|[Pp]ara|[Dd]e)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\b/g;
    const prepMatches = Array.from(rawText.matchAll(prepEntityRegex));
    for (const pm of prepMatches) {
      if (pm.index === undefined || !pm[1]) {
        continue;
      }
      const matchedName = pm[1].trim();
      const prepOffset = pm[0].indexOf(matchedName);
      const startIndex = pm.index + prepOffset;
      const endIndex = startIndex + matchedName.length;

      const words = matchedName.toLowerCase().split(/\s+/);
      const containsStopword = words.some(w => STOPWORDS.has(w));

      const alreadyAdded = entities.some(
        e => Math.max(startIndex, e.startIndex) < Math.min(endIndex, e.endIndex),
      );

      if (!containsStopword && !alreadyAdded && !isOccupied(startIndex, endIndex)) {
        entities.push({
          raw: matchedName,
          name: matchedName,
          startIndex,
          endIndex,
        });
        occupiedRanges.push({ start: startIndex, end: endIndex });
      }
    }

    // B2) Regla 1 (Gramatical): Nombres propios compuestos por 2 o más palabras en mayúscula (ej. Jose Martines, Juan Carrasco)
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

    // C) Entidades detectadas desde sintagmas
    for (const chunk of chunks) {
      if (chunk.type === 'entity' && !isOccupied(chunk.startIndex, chunk.endIndex)) {
        const alreadyAdded = entities.some(
          e => Math.max(chunk.startIndex, e.startIndex) < Math.min(chunk.endIndex, e.endIndex),
        );
        if (!alreadyAdded) {
          entities.push({
            raw: chunk.raw,
            name: chunk.cleanText,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
          });
          occupiedRanges.push({ start: chunk.startIndex, end: chunk.endIndex });
        }
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
      documents,
      locations,
      actions,
      conditions,
      chunks,
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
    const hasContactAnchor
      = tokens.phones.length > 0
        || tokens.emails.length > 0
        || tokens.documents.some(d => d.isValid);
    const hasEntity = tokens.entities.length > 0;
    const hasContext = tokens.contexts.length > 0;
    const hasEventChunk = tokens.chunks.some(c => c.type === 'event');
    const isMultiClause = tokens.chunks.length > 1;

    // Regla Biológica de Arquetipos de Átomo:
    // 1. Si hay sintagma de evento con contexto/cliente delimitado -> 'event'
    // 2. Si hay acción operativa o temporal -> 'task'
    // 3. Si hay entidad + anclaje de contacto (tel/email/documento) sin acción ni fecha -> 'client' (Ficha emergente)
    // 4. Si hay entidad o contexto sin acción -> 'note'
    // 5. Si no hay anclajes -> 'inbox'
    let coreType = 'inbox';
    let title = tokens.cleanText.length > 0 ? tokens.cleanText : text.trim();

    if (
      hasEventChunk
      && (isMultiClause || hasContactAnchor || hasEntity || tokens.locations.length > 0)
    ) {
      coreType = 'event';
      const eventChunk = tokens.chunks.find(c => c.type === 'event')!;
      let eventTitle = eventChunk.cleanText;

      // Si el evento contiene la expresión temporal, removerla del título para dejar el propósito limpio
      if (
        tokens.temporal
        && tokens.temporal.startIndex >= eventChunk.startIndex
        && tokens.temporal.endIndex <= eventChunk.endIndex
      ) {
        const relStart = tokens.temporal.startIndex - eventChunk.startIndex;
        const relEnd = tokens.temporal.endIndex - eventChunk.startIndex;
        eventTitle = eventChunk.raw.slice(0, relStart) + eventChunk.raw.slice(relEnd);
      } else if (
        tokens.temporal
        && eventChunk.raw.toLowerCase().includes(tokens.temporal.expression.toLowerCase())
      ) {
        const escaped = tokens.temporal.expression.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&',
        );
        eventTitle = eventTitle.replace(
          new RegExp(`\\b(?:el\\s+)?${escaped}\\b`, 'i'),
          '',
        );
      }
      // Limpiar preposiciones residuales al final ("para", "el", "a las", etc.) y espacios
      eventTitle = eventTitle.replace(/\s+(?:el|para|a\s+las?|en|de)\s*$/i, '').trim();
      eventTitle = eventTitle.replace(/\s+/g, ' ').trim();
      if (eventTitle.length > 0) {
        eventTitle = eventTitle.charAt(0).toUpperCase() + eventTitle.slice(1);
      }
      title = eventTitle || title;
    } else if (isOperative) {
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

    // Sinapsis de Documentos Fiscales (DNI, NIE, CIF) -> HAS_DOCUMENT
    for (const doc of tokens.documents) {
      synapses.push({
        relationType: 'HAS_DOCUMENT',
        targetEntityName: doc.documentNumber,
        targetType: 'anchor_document',
        metadata: {
          raw: doc.raw,
          type: doc.type,
          isValid: doc.isValid,
        },
      });
    }

    // Sinapsis de Ubicación (GPS, Plus Code, Dirección) -> AT_LOCATION
    for (const loc of tokens.locations) {
      synapses.push({
        relationType: 'AT_LOCATION',
        targetEntityName: loc.normalized,
        targetType: 'anchor_location',
        metadata: {
          raw: loc.raw,
          type: loc.type,
          ...(loc.coordinates ? { coordinates: loc.coordinates } : {}),
        },
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
          chunks: tokens.chunks,
          phones: tokens.phones.map(p => p.number),
          emails: tokens.emails.map(e => e.email),
          documents: tokens.documents.filter(d => d.isValid).map(d => d.documentNumber),
          locations: tokens.locations.map(l => ({
            type: l.type,
            normalized: l.normalized,
            ...(l.coordinates ? { coordinates: l.coordinates } : {}),
          })),
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
