/**
 * Definición de sub-steps por fase — metadatos de UI.
 *
 * Solo IDENTITY y EXECUTION tienen sub-steps con nombre,
 * descripción e icono que se muestran como cards anidadas dentro de la
 * PhaseCard principal.
 *
 * ANALYSIS (Fase 01) no renderiza sub-cards; solo tiene quiz → report
 * implícito.
 *
 * Los metadatos están ordenados por `order` (0-based) y deben coincidir
 * con el orden lógico que el agente usa vía `subStep` / `subStepOrder`
 * en la DB.
 */

export interface SubStepMeta {
  id: string;
  order: number; // 0-based
  label: string; // "Nombre", "Voz y Tono", etc.
  description: string; // Breve descripción del sub-step
  icon: string; // Nombre del icono Lucide (ej. "Type", "MessageSquare", etc.)
}

export const PHASE_SUBSTEPS: Record<string, SubStepMeta[]> = {
  IDENTITY: [
    {
      id: "naming",
      order: 0,
      label: "Naming",
      description: "Elige el nombre de tu proyecto",
      icon: "Type",
    },
    {
      id: "voice",
      order: 1,
      label: "Voz y Tono",
      description: "Define la personalidad de tu marca",
      icon: "MessageSquare",
    },
    {
      id: "visual",
      order: 2,
      label: "Estilo Visual",
      description: "Fuentes, colores e identidad visual. Al completar se genera el Brand Book automáticamente.",
      icon: "Palette",
    },
  ],
  EXECUTION: [
    {
      id: "quiz",
      order: 0,
      label: "Cuestionario",
      description: "Plan de lanzamiento",
      icon: "HelpCircle",
    },
    {
      id: "simulate",
      order: 1,
      label: "Simulación",
      description: "Escenarios y riesgos",
      icon: "PlayCircle",
    },
    {
      id: "final",
      order: 2,
      label: "Plan de Ejecución",
      description: "Roadmap de lanzamiento",
      icon: "Rocket",
    },
  ],
  // ANALYSIS: no tiene sub-steps con sub-cards (solo quiz → report implícito).
};

/**
 * Devuelve el índice 0-based de un sub-step dado su id y tipo de fase.
 * Retorna -1 si no se encuentra.
 */
export function getSubStepIndex(
  subStepId: string | null | undefined,
  phaseType: string
): number {
  if (!subStepId) return -1;
  const substeps = PHASE_SUBSTEPS[phaseType];
  if (!substeps) return -1;
  const entry = substeps.find((s) => s.id === subStepId);
  return entry ? entry.order : -1;
}

/**
 * Mapa de tono de color para los sub-steps, heredado del tono de la fase
 * padre. Se usa en el número circular y en los estados `available` y
 * `substep_ready`.
 *
 * Mapea tonos no existentes en `toneNumberStyles` al más cercano:
 *  - cyan → blue
 *  - orange → amber
 */
export const subStepToneMap: Record<string, string> = {
  IDENTITY: "purple",
  BUSINESS: "blue", // blue en lugar de cyan para consistencia con toneNumberStyles
  CONTENT: "amber",
  EXECUTION: "amber", // amber en lugar de orange
};
