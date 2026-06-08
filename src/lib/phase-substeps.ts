/**
 * Definición de sub-steps por fase — metadatos de UI.
 *
 * Cada fase del proyecto (excepto ANALYSIS) tiene sub-steps con nombre,
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
      label: "03.A Naming",
      description: "Elige el nombre de tu proyecto",
      icon: "Type",
    },
    {
      id: "voice",
      order: 1,
      label: "03.B Voz y Tono",
      description: "Define la personalidad de tu marca",
      icon: "MessageSquare",
    },
    {
      id: "visual",
      order: 2,
      label: "03.C Estilo Visual",
      description: "Fuentes, colores e identidad visual. Al completar se genera el Brand Book automáticamente.",
      icon: "Palette",
    },
  ],
  CONTENT: [
    {
      id: "quiz",
      order: 0,
      label: "Cuestionario",
      description: "Estrategia de contenido",
      icon: "HelpCircle",
    },
    {
      id: "pilars",
      order: 1,
      label: "Pilares de Contenido",
      description: "Temas y calendario editorial",
      icon: "LayoutGrid",
    },
    {
      id: "final",
      order: 2,
      label: "Estrategia Final",
      description: "Plan de contenido completo",
      icon: "FileText",
    },
  ],
  DEVELOPMENT: [
    {
      id: "quiz",
      order: 0,
      label: "Cuestionario",
      description: "Requisitos técnicos",
      icon: "HelpCircle",
    },
    {
      id: "compare",
      order: 1,
      label: "Comparativa",
      description: "Comparación de stacks y arquitecturas",
      icon: "GitCompare",
    },
    {
      id: "final",
      order: 2,
      label: "Especificación Técnica",
      description: "Documento de desarrollo",
      icon: "Code",
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
  DEVELOPMENT: "green",
  EXECUTION: "amber", // amber en lugar de orange
};
