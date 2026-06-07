/**
 * IDENTITY phase sub-step machinery.
 *
 * The IDENTITY phase is presented to the user as 4 sequential sub-steps
 * (each one a full quiz / preview → user choice → next sub-step cycle):
 *
 *   0. naming       → choose a brand name (A/B/C + custom)
 *   1. voice        → voice & tone quiz (personality of the brand)
 *   2. visual       → visual style preview (HTML mockup with fonts/colors/logo)
 *   3. final        → consolidated brand book (downloaded, in-app)
 *
 * Each sub-step has a stable `id` (string), a `label` (UI text) and a
 * `description` (UI subtext). The `subStepOrder` integer field in the DB
 * mirrors the position in this list. The agent emits its current sub-step
 * via the `subStep` field on the ProjectPhase row.
 *
 * Transition rules:
 *  - When the user confirms a sub-step, the helper auto-advances to the next
 *    one in this list ("naming" → "voice" → "visual" → "final" → null).
 *  - `null` means the phase is fully complete.
 *
 * IMPORTANT: keep this list and the agent's expected subStep values in
 * sync. The agent `project-branding` reads `subStep` from the job input to
 * decide what to emit.
 */

export const IDENTITY_SUBSTEP_ORDER = [
  {
    id: "naming",
    order: 0,
    label: "Nombre",
    description: "Elige el nombre de tu proyecto",
  },
  {
    id: "voice",
    order: 1,
    label: "Voz y Tono",
    description: "Define la personalidad de tu marca",
  },
  {
    id: "visual",
    order: 2,
    label: "Estilo Visual",
    description: "Fuentes, colores e identidad visual",
  },
  {
    id: "final",
    order: 3,
    label: "Brand Book",
    description: "Documento final con toda la identidad",
  },
] as const;

export type IdentitySubStepId = (typeof IDENTITY_SUBSTEP_ORDER)[number]["id"];

/** Map for quick lookup: id → index, and id → metadata. */
const IDENTITY_BY_ID: Record<string, (typeof IDENTITY_SUBSTEP_ORDER)[number] | undefined> =
  Object.fromEntries(IDENTITY_SUBSTEP_ORDER.map((s) => [s.id, s]));

/**
 * Returns the next sub-step id in the IDENTITY flow, given the current one.
 *
 *   "naming" → "voice"
 *   "voice"  → "visual"
 *   "visual" → "final"
 *   "final"  → null   (fase completada)
 *   null     → "naming"  (fresh start: first sub-step)
 *   unknown  → "naming" (safe fallback: start from the beginning)
 */
export function getNextIdentitySubStep(current: string | null | undefined): string | null {
  if (!current) {
    // Fresh start: the phase has not begun a sub-step yet → naming.
    return "naming";
  }
  const idx = IDENTITY_SUBSTEP_ORDER.findIndex((s) => s.id === current);
  if (idx === -1) {
    // Unknown id — safe fallback: restart from naming.
    return "naming";
  }
  const next = IDENTITY_SUBSTEP_ORDER[idx + 1];
  return next ? next.id : null;
}

/**
 * Returns the 0-based index of a sub-step in the IDENTITY flow.
 *   "naming" → 0
 *   "voice"  → 1
 *   "visual" → 2
 *   "final"  → 3
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
  IDENTITY_SUBSTEP_ORDER.map((s) => s.id);
