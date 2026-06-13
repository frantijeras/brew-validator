/**
 * Tipos canónicos (PLANOS) de la sección de Skills.
 *
 * Única fuente de verdad compartida por GET/PUT `/skills`, el selector de la UI
 * y el builder del Handoff. Antes había un desajuste de forma: el GET devolvía
 * `SkillRecommendation` ANIDADO (`{ skill: {...}, confidence }`) mientras la UI
 * esperaba este objeto plano, lo que dejaba `name`/`id` en `undefined`.
 */

export type SkillCategory =
  | "desarrollo"
  | "marketing"
  | "operaciones"
  | "legal"
  | "finanzas";

/**
 * Skill del catálogo (forma plana). Sin motor de recomendación: el conjunto es
 * fijo y se generan todas. `selected`/`custom` se mantienen opcionales por
 * compatibilidad con datos antiguos en `project.skills`.
 */
export interface SkillData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  selected?: boolean;
  custom?: boolean;
}

/** Skill generada (contenido markdown) que va al Handoff. */
export interface GeneratedSkill {
  id: string;
  name: string;
  content: string;
  /**
   * Origen del contenido:
   *  - "template": plantilla determinista.
   *  - "ai": mejorada con IA vía Bridge.
   *  - "ai-pending": marcador transitorio mientras el agente genera (no final).
   */
  source?: "template" | "ai" | "ai-pending";
}
