import type {
  IngestIntent,
  ParsedContextToken,
  ParsedEntityToken,
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

export class OmnibarParser {
  /**
   * Extrae tokens (@entidad, //fecha, #contexto) y texto limpio del input del usuario.
   */
  static extractTokens(text: string, options: ParserOptions = {}): ParsedTokens {
    const rawText = text ?? '';
    const knownEntities = options.knownEntities ?? [];
    const refDate = options.referenceDate ?? new Date();

    const entities: ParsedEntityToken[] = [];
    const contexts: ParsedContextToken[] = [];
    let temporal: ParsedTemporalToken | undefined;

    // Tokens a remover del texto limpio
    const rangesToRemove: Array<{ start: number; end: number }> = [];

    // 1. EXTRAER TEMPORAL (//...)
    // Detecta '//' seguido de texto hasta encontrar '#' o '@' o el final del string
    const temporalRegex = /\/\/([^\s#@][^#@]*)/g;
    const temporalMatches = Array.from(rawText.matchAll(temporalRegex));

    for (const tempMatch of temporalMatches) {
      const expression = tempMatch[1]?.trim() ?? '';
      const startIndex = tempMatch.index;

      if (expression.length > 0) {
        // Parsear con el motor en español de chrono-node
        const parsedResults = chrono.es.parse(expression, refDate);

        if (parsedResults.length > 0 && parsedResults[0]) {
          const firstResult = parsedResults[0];
          const date = firstResult.date();
          const hasTime = firstResult.start.isCertain('hour');

          // El rango exacto abarca desde el '//' hasta el final del texto reconocido por Chrono
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
          break; // Solo permitimos un token temporal principal por entrada
        }
      }
    }

    // 2. EXTRAER CONTEXTOS (#...)
    // Soporta letras, números, guiones y caracteres acentuados
    const contextRegex = /#([\w\-\u00C0-\u017F]+)/g;
    const contextMatches = Array.from(rawText.matchAll(contextRegex));

    for (const ctxMatch of contextMatches) {
      const fullMatch = ctxMatch[0];
      const name = ctxMatch[1] ?? '';
      const startIndex = ctxMatch.index;
      const endIndex = startIndex + fullMatch.length;

      // Evitar colisión si estaba dentro del rango temporal ya procesado
      const overlapsTemporal = temporal
        && startIndex >= temporal.startIndex
        && endIndex <= temporal.endIndex;

      if (!overlapsTemporal && name.length > 0) {
        contexts.push({
          raw: fullMatch,
          name,
          startIndex,
          endIndex,
        });
        rangesToRemove.push({ start: startIndex, end: endIndex });
      }
    }

    // 3. EXTRAER ENTIDADES (@...)
    // Ordenamos las entidades conocidas de mayor a menor longitud para Greedy Longest Match (@Jose Carlos antes de @Jose)
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
      // Ignorar si el '@' está dentro de un rango ya asignado (ej. temporal)
      const overlaps = rangesToRemove.some(
        r => atIndex >= r.start && atIndex < r.end,
      );
      if (overlaps) {
        continue;
      }

      const substringAfterAt = rawText.slice(atIndex + 1);

      // A) Intentar coincidencia con entidad conocida (Greedy match)
      let matchedKnown: { id: string; name: string } | null = null;

      for (const known of sortedKnown) {
        if (
          substringAfterAt.toLowerCase().startsWith(known.name.toLowerCase())
        ) {
          const charAfter = substringAfterAt[known.name.length];
          // Debe terminar la palabra o estar seguido de espacio o puntuación
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
        continue;
      }

      // B) Entidad desconocida / nueva: delimitar por puntuación, siguiente token o límite natural
      // Captura palabras consecutivas que empiecen por mayúscula (ej. @Juan Perez) o una sola palabra
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
      }
    }

    // 4. GENERAR TEXTO LIMPIO (Eliminar los tokens del cuerpo principal)
    // Ordenamos los rangos de final a inicio para cortar sin desfasar los índices
    const sortedRanges = [...rangesToRemove].sort((a, b) => b.start - a.start);
    let cleanText = rawText;

    for (const range of sortedRanges) {
      cleanText = cleanText.slice(0, range.start) + cleanText.slice(range.end);
    }

    // Limpiar espacios dobles o residuales
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return {
      entities,
      contexts,
      temporal,
      cleanText,
    };
  }

  /**
   * Transforma el texto de entrada en un IngestIntent universal.
   */
  static parseToIntent(
    text: string,
    options: ParserOptions = {},
  ): IngestIntent {
    const tokens = this.extractTokens(text, options);

    const hasTokens = tokens.entities.length > 0
      || tokens.contexts.length > 0
      || !!tokens.temporal;

    // Regla Biológica:
    // Si no hay etiquetas ni fechas, el átomo es neutro ('inbox').
    // Si hay tokens, es una 'task' (o 'note' si no hay vencimiento).
    let coreType = 'inbox';
    if (hasTokens) {
      coreType = tokens.temporal ? 'task' : 'note';
    }

    const title = tokens.cleanText.length > 0
      ? tokens.cleanText
      : text.trim();

    // Generar Sinapsis
    const synapses: IngestIntent['synapses'] = [];

    // Sinapsis de Entidades (@) -> ASSIGNED_TO
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

    // Temporal (//)
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
        },
      },
      synapses,
      temporal: temporalData,
    });
  }
}
