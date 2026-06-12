/**
 * Schemas Zod (validación estructurada) del OUTPUT de la IA (Inteligencia
 * Artificial) por fase del flujo "Proyectos".
 *
 * Garantizan que lo que devuelve el agente del Bridge (Puente con las APIs de
 * IA) tiene la forma que la app espera ANTES de persistirlo. Si rompe el
 * esquema, el callback reintenta con instrucción explícita de formato y, si
 * vuelve a fallar, intenta una corrección heurística (ver `coerceJsonObject`).
 *
 * FILOSOFÍA: tolerantes pero con forma. El contenido del informe es markdown
 * (string), así que validamos la ENVOLTURA (modo, sub-paso, presencia de
 * contenido/preguntas), no la prosa interna — el orden estricto de secciones es
 * responsabilidad del prompt de la skill, no del validador.
 */

import { z } from "zod";

/** Tipos de pregunta admitidos en un quiz dinámico (Cuestionario). */
export const questionTypeSchema = z.enum(["text", "textarea", "choice", "multi"]);

/** Una pregunta del quiz dinámico generada por la IA. */
export const questionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: questionTypeSchema,
  // Las opciones del quiz vienen como STRINGS simples (formato real de los
  // skills y del bridge), p. ej. ["Opción A", "Opción B"]. Aceptamos también
  // la forma { value, label } por compatibilidad, pero la forma string es la
  // que usan los agentes — exigir objetos rompía la validación ("JSON roto").
  options: z
    .array(z.union([z.string(), z.object({ value: z.string(), label: z.string() })]))
    .optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
});

/** Output del job en modo "questions": lista de preguntas no vacía. */
export const quizOutputSchema = z.object({
  mode: z.literal("questions").optional(),
  questions: z.array(questionSchema).min(1, "El quiz no tiene preguntas"),
});

/** Opción seleccionable de un sub-paso (naming, voice, visual...). */
export const subStepOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

/** Artefacto intermedio de un sub-paso (lo revisa el usuario en SUBSTEP_READY). */
export const subStepArtifactSchema = z.object({
  type: z.enum(["html", "markdown"]),
  content: z.string().min(1, "El artefacto del sub-paso está vacío"),
  options: z.array(subStepOptionSchema).optional(),
});

/**
 * Output del job en modo "report". Aceptamos varias formas equivalentes que el
 * agente puede emitir (`reportMarkdown` | `content` | `subStepArtifact`), igual
 * que el callback. Se exige que AL MENOS una fuente de contenido esté presente.
 */
export const reportOutputSchema = z
  .object({
    mode: z.literal("report").optional(),
    subStep: z.string().nullable().optional(),
    type: z.enum(["html", "markdown"]).optional(),
    reportMarkdown: z.string().optional(),
    content: z.string().optional(),
    options: z.array(subStepOptionSchema).optional(),
    subStepArtifact: subStepArtifactSchema.optional(),
    subStepArtifactJson: subStepArtifactSchema.optional(),
  })
  .refine(
    (o) =>
      (typeof o.reportMarkdown === "string" && o.reportMarkdown.trim().length > 0) ||
      (typeof o.content === "string" && o.content.trim().length > 0) ||
      !!o.subStepArtifact ||
      !!o.subStepArtifactJson,
    { message: "El informe no contiene markdown ni artefacto utilizable" }
  );

export type QuizOutput = z.infer<typeof quizOutputSchema>;
export type ReportOutput = z.infer<typeof reportOutputSchema>;
export type Question = z.infer<typeof questionSchema>;
export type SubStepArtifact = z.infer<typeof subStepArtifactSchema>;

/** Versión del esquema esperado (info técnica 3.3 — se guarda en BridgeLog). */
export const PHASE_SCHEMA_VERSION = "1.0.0";

export interface SafeParseResult<T> {
  success: boolean;
  data: T | null;
  /** Mensajes de error legibles (para el log + instrucción de reintento). */
  errors: string[];
}

/**
 * Intenta convertir un valor cualquiera (string JSON, objeto, o string con JSON
 * embebido) en un objeto plano. Esta es la red de "corrección heurística":
 * extrae el primer bloque `{...}` de un texto si el JSON viene rodeado de prosa
 * o de fences de markdown (```json ... ```).
 */
export function coerceJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string") return null;

  const text = raw.trim();
  // 1) Intento directo
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* sigue con heurística */
  }

  // 2) Quitar fences de markdown ```json ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* sigue */
    }
  }

  // 3) Extraer el primer objeto {...} balanceado del texto
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* nada que hacer */
    }
  }

  return null;
}

/** Formatea los issues de Zod en mensajes cortos legibles. */
function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.length ? `${i.path.join(".")}: ` : "";
    return `${path}${i.message}`;
  });
}

/**
 * Valida el output de un job de fase contra el esquema del modo correspondiente.
 * Tolera entradas crudas (string/markdown) gracias a `coerceJsonObject`.
 *
 * @param mode  "questions" | "report"
 * @param raw   output crudo del agente (string u objeto)
 */
export function safeParsePhaseOutput(
  mode: "questions" | "report",
  raw: unknown
): SafeParseResult<QuizOutput | ReportOutput> {
  const obj = coerceJsonObject(raw);
  if (!obj) {
    return {
      success: false,
      data: null,
      errors: ["No se pudo interpretar la respuesta como objeto JSON"],
    };
  }

  const schema = mode === "questions" ? quizOutputSchema : reportOutputSchema;
  const result = schema.safeParse(obj);
  if (result.success) {
    return { success: true, data: result.data, errors: [] };
  }
  return { success: false, data: null, errors: formatZodErrors(result.error) };
}
