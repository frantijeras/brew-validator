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

/** Skill (recomendación + selección del usuario), forma plana. */
export interface SkillData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  /** 0..1 — confianza de la recomendación. */
  confidence: number;
  /** Texto legible del porqué de la recomendación. */
  reason: string;
  recommended: boolean;
  selected: boolean;
  custom: boolean;
  /** Condiciones cumplidas (chips "Basado en:"). Opcional para back-compat. */
  matchedConditions?: string[];
}

/** Skill generada (contenido markdown) que va al Handoff. */
export interface GeneratedSkill {
  id: string;
  name: string;
  content: string;
  /** Origen del contenido: plantilla determinista o mejora con IA. */
  source?: "template" | "ai";
}
