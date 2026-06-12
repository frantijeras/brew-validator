/**
 * phase-loading-messages.ts — helpers PUROS (sin React, sin DOM) que
 * mapean el estado/contexto de una fase a su mensaje de carga
 * contextual mostrado junto al spinner o skeleton.
 *
 * La arquitectura usa Auto-Triggers (activaciones automáticas) en
 * cascada: al completar la Fase X se dispara la generación del quiz
 * de la Fase X+1. Estos mensajes comunican al usuario QUÉ se está
 * "cocinando" en segundo plano.
 *
 * Al ser lógica pura, se testea en scripts/smoke-e2e.ts.
 */

/** Estados visuales de la tarjeta de fase (espejo de PhaseCardStatus). */
export type PhaseLoadingStatus =
  | "available"
  | "questioning"
  | "processing"
  | "substep"
  | "completed"
  | "locked";

export interface PhaseLoadingContext {
  /**
   * Si la fase ya tiene preguntas generadas. Cuando está en
   * `processing` con preguntas ya generadas, se está generando el
   * informe; sin preguntas, se están generando las preguntas.
   */
  hasQuestions?: boolean;
  /**
   * Si la fase acaba de desbloquearse por un Auto-Trigger (activación
   * automática) y su contenido aún se está calculando. En ese caso se
   * muestra el skeleton con el mensaje "Preparando la siguiente fase…".
   */
  justUnlocked?: boolean;
}

/** Mensaje mostrado mientras una fase recién desbloqueada se "cocina". */
export const PHASE_PREPARING_MESSAGE = "Preparando la siguiente fase…";

/**
 * getPhaseLoadingMessage — devuelve el mensaje contextual de carga
 * para un estado de fase, o `null` si ese estado no implica carga
 * activa (no se muestra spinner/skeleton).
 */
export function getPhaseLoadingMessage(
  status: PhaseLoadingStatus,
  ctx: PhaseLoadingContext = {}
): string | null {
  // Fase recién desbloqueada por Auto-Trigger, aún calculando.
  if (ctx.justUnlocked) {
    return PHASE_PREPARING_MESSAGE;
  }

  switch (status) {
    case "processing":
      // Con preguntas ya generadas -> generando informe.
      // Sin preguntas -> generando preguntas.
      return ctx.hasQuestions
        ? "Generando informe…"
        : "Generando preguntas…";
    case "questioning":
      // El quiz aún se está generando hasta que haya preguntas.
      return ctx.hasQuestions ? null : "Generando preguntas…";
    case "available":
    case "substep":
    case "completed":
    case "locked":
      return null;
  }
}

/**
 * isPhaseLoading — true si el estado/contexto implica un job en
 * marcha que debe mostrar feedback de carga (spinner o skeleton).
 */
export function isPhaseLoading(
  status: PhaseLoadingStatus,
  ctx: PhaseLoadingContext = {}
): boolean {
  return getPhaseLoadingMessage(status, ctx) !== null;
}
