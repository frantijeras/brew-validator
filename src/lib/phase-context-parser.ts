/**
 * phase-context-parser.ts — Parser (analizador sintáctico) de densidad de contexto.
 *
 * Objetivo: cuando alimentamos una fase con los artefactos de fases previas
 * COMPLETED (completadas), hoy se inyecta el contenido CRUDO de cada artefacto.
 * Ese contenido puede ser enorme e incluir ruido (preguntas del quiz —
 * cuestionario—, opciones intermedias, debates, logs —registros—), lo que
 * degrada el contexto del modelo (LLM, modelo de lenguaje grande) y
 * desperdicia tokens (unidades de procesamiento de texto).
 *
 * Este módulo expone funciones PURAS y DETERMINISTAS (mismo input → mismo
 * output, sin efectos secundarios) que reciben los artefactos previos y
 * devuelven SOLO el resultado consolidado de cada fase, acotado en tamaño.
 *
 * Sin dependencias nuevas. Documentado en español.
 */

/** Forma mínima de un artefacto tal como se persiste en ProjectPhase.artifacts. */
export interface PhaseArtifactLike {
  title: string;
  content: string;
}

/** Resumen consolidado y acotado de una fase previa. */
export interface PhaseContextSummary {
  /** Identificador o etiqueta de la fase (p.ej. el título del artefacto). */
  phase: string;
  /** Título legible del informe consolidado. */
  title: string;
  /** Contenido consolidado y recortado, listo para inyectar en el prompt. */
  summary: string;
}

/** Opciones de configuración del parser. */
export interface PhaseContextParserOptions {
  /**
   * Máximo de caracteres por fase tras el recorte. Por defecto 3000
   * (rango recomendado 2500-3500). Preserva el principio del contenido
   * (encabezados y secciones clave).
   */
  maxCharsPerPhase?: number;
}

/** Valor por defecto del recorte por fase (caracteres). */
export const DEFAULT_MAX_CHARS_PER_PHASE = 3000;

/**
 * Patrones que delatan secciones de RUIDO (no forman parte del resultado
 * consolidado). Se eliminan junto con su contenido hasta el siguiente
 * encabezado del mismo nivel o superior.
 *
 * Cubre: preguntas del quiz (cuestionario), opciones intermedias, debates y
 * deliberaciones internas que el agente a veces vuelca en el informe.
 */
const NOISE_HEADING_PATTERNS: RegExp[] = [
  /quiz|cuestionario/i,
  /\bpreguntas?\b/i,
  /opciones?\s+(intermedias?|propuestas?)/i,
  /\bdebate\b|\bdeliberaci[oó]n\b/i,
  /\bborrador(es)?\b/i,
  /\blogs?\b|\bregistro\s+intermedio\b/i,
];

/**
 * Patrones EXTRA específicos del HANDOFF (entrega final). El paquete final debe
 * contener el proyecto consolidado, NO el proceso de selección: fuera las
 * rondas de naming, las enumeraciones de opciones A/B/C, la validación de las
 * respuestas del quiz y la narración "mi recomendación" (la decisión final ya
 * vive consolidada en AGENT.md / Project.memory).
 */
const HANDOFF_PROCESS_HEADING_PATTERNS: RegExp[] = [
  ...NOISE_HEADING_PATTERNS,
  /\bronda\s*\d|lluvia|finalistas?|filtrad/i,
  /^opci[oó]n\s+[a-cA-C]\b|opciones?\s+(de\s+)?(nombre|naming|estilo|logo)/i,
  /validaci[oó]n\s+de\s+(tus\s+)?respuestas/i,
  /\bmi\s+recomendaci[oó]n\b|recomendaci[oó]n\s+final/i,
  /campo\s+manual/i,
];

/**
 * Detecta el nivel de un encabezado markdown (## …). Devuelve el número de
 * almohadillas (1-6) o 0 si la línea no es un encabezado.
 */
function headingLevel(line: string): number {
  const match = /^(#{1,6})\s+/.exec(line);
  return match ? match[1].length : 0;
}

/** Indica si el TEXTO de un encabezado coincide con algún patrón dado. */
function headingMatches(line: string, patterns: RegExp[]): boolean {
  const text = line.replace(/^#{1,6}\s+/, "");
  return patterns.some((re) => re.test(text));
}

/**
 * Núcleo: elimina las secciones markdown cuyo encabezado coincide con
 * `patterns`. Una "sección" abarca desde su encabezado hasta el siguiente
 * encabezado de nivel igual o más superficial, o el fin del texto.
 *
 * Si el contenido NO parece markdown (sin encabezados), se devuelve intacto:
 * preferimos no adivinar y conservar el resultado.
 */
function stripSectionsByPatterns(content: string, patterns: RegExp[]): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let skipUntilLevel: number | null = null;

  for (const line of lines) {
    const level = headingLevel(line);

    if (skipUntilLevel !== null) {
      if (level > 0 && level <= skipUntilLevel) {
        skipUntilLevel = null;
        // No hacemos "continue": esta línea debe re-evaluarse abajo.
      } else {
        continue; // seguir descartando
      }
    }

    if (level > 0 && headingMatches(line, patterns)) {
      skipUntilLevel = level;
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

/** Elimina las secciones de RUIDO (quiz, opciones intermedias, debates…). */
export function stripNoiseSections(content: string): string {
  return stripSectionsByPatterns(content, NOISE_HEADING_PATTERNS);
}

/**
 * Elimina el PROCESO DE SELECCIÓN para el handoff (rondas, opciones A/B/C,
 * validación de respuestas, "mi recomendación"). Deja el resultado consolidado.
 */
export function stripProcessSections(content: string): string {
  return stripSectionsByPatterns(content, HANDOFF_PROCESS_HEADING_PATTERNS);
}

/**
 * Recorta un contenido markdown a un máximo de caracteres, preservando el
 * principio (encabezados y primeras líneas de cada sección clave).
 *
 * Estrategia determinista:
 *  1. Si ya cabe, se devuelve tal cual (recortando espacios al final).
 *  2. Si hay secciones markdown (## …), se reconstruye conservando cada
 *     encabezado y sus primeras líneas, sección a sección, hasta agotar el
 *     presupuesto de caracteres. Así NO se pierde ningún encabezado clave
 *     mientras quepa, y se prioriza el inicio de cada sección.
 *  3. Si no hay encabezados, se hace un corte simple por longitud.
 * En todos los casos se añade un marcador "…" cuando hubo recorte.
 */
export function truncatePreservingHeadings(
  content: string,
  maxChars: number,
): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  const lines = trimmed.split("\n");
  const hasHeadings = lines.some((l) => headingLevel(l) > 0);

  // Marcador de recorte. Reservamos su tamaño en el presupuesto para que el
  // resultado nunca exceda maxChars al añadirlo.
  const ELLIPSIS = "\n\n…";
  const budget = Math.max(0, maxChars - ELLIPSIS.length);

  if (!hasHeadings) {
    // Corte simple. Intentamos cortar en un límite de palabra para no
    // partir tokens a la mitad de forma fea.
    const slice = trimmed.slice(0, budget);
    const lastSpace = slice.lastIndexOf(" ");
    const safe = lastSpace > budget * 0.6 ? slice.slice(0, lastSpace) : slice;
    return `${safe.trimEnd()}${ELLIPSIS}`;
  }

  // Agrupar en secciones [encabezado, ...cuerpo].
  const sections: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (headingLevel(line) > 0 && current.length > 0) {
      sections.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    sections.push(current);
  }

  const result: string[] = [];
  let used = 0;
  let truncated = false;

  for (const section of sections) {
    // Dentro de cada sección, añadimos líneas mientras quepan; el encabezado
    // (primera línea) tiene prioridad para conservarse.
    const sectionLines: string[] = [];
    for (const line of section) {
      const cost = line.length + 1; // +1 por el salto de línea
      if (used + cost > budget) {
        truncated = true;
        break;
      }
      sectionLines.push(line);
      used += cost;
    }
    if (sectionLines.length > 0) {
      result.push(sectionLines.join("\n"));
    }
    if (truncated) {
      break;
    }
  }

  const body = result.join("\n").trimEnd();
  return truncated || body.length < trimmed.length ? `${body}${ELLIPSIS}` : body;
}

/**
 * Extrae el resultado consolidado de UN artefacto de fase: elimina el ruido
 * (quiz, opciones, debates) y recorta el tamaño. Devuelve null si, tras
 * limpiar, no queda contenido útil.
 */
export function parsePhaseArtifact(
  artifact: PhaseArtifactLike,
  options: PhaseContextParserOptions = {},
): PhaseContextSummary | null {
  const maxChars = options.maxCharsPerPhase ?? DEFAULT_MAX_CHARS_PER_PHASE;
  const rawContent = typeof artifact.content === "string" ? artifact.content : "";

  const cleaned = stripNoiseSections(rawContent).trim();
  if (!cleaned) {
    return null;
  }

  const summary = truncatePreservingHeadings(cleaned, maxChars);
  if (!summary.trim()) {
    return null;
  }

  const title = (artifact.title || "").trim() || "Fase previa";
  return {
    phase: title,
    title,
    summary,
  };
}

/**
 * Procesa la lista de artefactos previos (uno por fase) y devuelve los
 * resúmenes consolidados y acotados. Mantiene el orden de entrada y descarta
 * los artefactos vacíos o que quedan sin contenido tras limpiar.
 */
export function parsePreviousPhaseArtifacts(
  artifacts: PhaseArtifactLike[],
  options: PhaseContextParserOptions = {},
): PhaseContextSummary[] {
  if (!Array.isArray(artifacts)) {
    return [];
  }
  const summaries: PhaseContextSummary[] = [];
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact.content !== "string") {
      continue;
    }
    const parsed = parsePhaseArtifact(artifact, options);
    if (parsed) {
      summaries.push(parsed);
    }
  }
  return summaries;
}

/**
 * Construye un único string consolidado a partir de los resúmenes, listo para
 * inyectar en el prompt del agente. Cada fase se separa con un encabezado.
 */
export function buildConsolidatedContext(
  summaries: PhaseContextSummary[],
): string {
  return summaries
    .map((s) => `## ${s.title}\n\n${s.summary}`)
    .join("\n\n---\n\n");
}
