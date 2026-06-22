/**
 * IDENTITY phase sub-step machinery.
 *
 * The IDENTITY phase is presented to the user as 4 sequential sub-steps
 * (each one a full quiz / preview → user choice → next sub-step cycle):
 *
 *   0. naming       → choose a brand name (A/B/C + custom)
 *   1. voice        → voice & tone quiz (personality of the brand)
 *   2. logo         → 12 SVG logo variants (HTML grid); user picks one
 *   3. visual       → visual style + mockup (HTML mockup w/ embedded logo) +
 *                     style-guide PDF. This is the LAST sub-step; completing it
 *                     closes the phase. There is NO Brand Book consolidation.
 *
 * Each sub-step has a stable `id` (string), a `label` (UI text) and a
 * `description` (UI subtext). The `subStepOrder` integer field in the DB
 * mirrors the position in this list. The agent emits its current sub-step
 * via the `subStep` field on the ProjectPhase row.
 *
 * Transition rules:
 *  - When the user confirms a sub-step, the helper auto-advances to the next
 *    one in this list ("naming" → "voice" → "logo" → "visual" → null).
 *  - `null` means the phase is fully complete (after "visual").
 *
 * IMPORTANT: keep this list and the agents' expected subStep values in
 * sync. Cada sub-paso lo sirve su propia sub-skill
 * (naming→project-naming, voice→project-voice, logo→project-logo,
 * visual→project-template); el bridge elige el SKILL.md por `agentName`.
 *
 * Los metadatos de sub-steps se derivan de PHASE_SUBSTEPS.IDENTITY en
 * phase-substeps.ts para evitar duplicación. Este archivo mantiene las
 * funciones helper de transición (getNextIdentitySubStep, etc.) por
 * compatibilidad con consumidores existentes.
 */

import { PHASE_SUBSTEPS } from "./phase-substeps";

/**
 * IDENTITY sub-step order — derivado de PHASE_SUBSTEPS.IDENTITY.
 * Mantiene la misma forma que antes para compatibilidad.
 */
export const IDENTITY_SUBSTEP_ORDER = PHASE_SUBSTEPS.IDENTITY.map((s) => ({
  id: s.id,
  order: s.order,
  label: s.label,
  description: s.description,
})) as readonly {
  id: string;
  order: number;
  label: string;
  description: string;
}[];

// Re-assert read-only at runtime
Object.freeze(IDENTITY_SUBSTEP_ORDER);

export type IdentitySubStepId = (typeof IDENTITY_SUBSTEP_ORDER)[number]["id"];

/** Map for quick lookup: id → index, and id → metadata. */
const IDENTITY_BY_ID: Record<string, (typeof IDENTITY_SUBSTEP_ORDER)[number] | undefined> =
  Object.fromEntries(IDENTITY_SUBSTEP_ORDER.map((s) => [s.id, s]));

/**
 * Returns the next sub-step id in the IDENTITY flow, given the current one.
 *
 *   "naming" → "voice"
 *   "voice"  → "logo"
 *   "logo"   → "visual"
 *   "visual" → null   (fase completada)
 *   null     → "naming"  (fresh start: first sub-step)
 *   unknown  → "naming" (safe fallback: start from the beginning)
 */
export function getNextIdentitySubStep(current: string | null | undefined): string | null {
  if (!current) {
    return "naming";
  }
  const idx = IDENTITY_SUBSTEP_ORDER.findIndex((s) => s.id === current);
  if (idx === -1) {
    return "naming";
  }
  const next = IDENTITY_SUBSTEP_ORDER[idx + 1];
  return next ? next.id : null;
}

/**
 * Returns the 0-based index of a sub-step in the IDENTITY flow.
 *   "naming" → 0
 *   "voice"  → 1
 *   "logo"   → 2
 *   "visual" → 3
 *   null/unknown → -1
 */
export function getIdentitySubStepIndex(subStep: string | null | undefined): number {
  if (!subStep) return -1;
  const entry = IDENTITY_BY_ID[subStep];
  return entry ? entry.order : -1;
}

/**
 * Human label for a given sub-step id. Falls back to the id itself.
 */
export function getIdentitySubStepLabel(subStep: string | null | undefined): string {
  if (!subStep) return "";
  return IDENTITY_BY_ID[subStep]?.label || subStep;
}

/**
 * All sub-step ids in order. Useful for tests and for the UI sub-progress bar.
 */
export const IDENTITY_SUBSTEP_IDS: readonly IdentitySubStepId[] =
  IDENTITY_SUBSTEP_ORDER.map((s) => s.id) as readonly IdentitySubStepId[];
