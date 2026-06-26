/** Mapeo de veredicto (DB) → etiqueta en español */
export const VERDICT_LABELS: Record<string, string> = {
  GO: "Adelante",
  PIVOT: "Pulir idea",
  KILL: "No viable",
  ITERATE: "Revisa",
  // Spanish equivalents (from agents)
  Adelante: "Adelante",
  "Pulir idea": "Pulir idea",
  "No viable": "No viable",
  Revisa: "Revisa",
};

/** Mapeo de estado (DB) → etiqueta en español */
export const STATUS_LABELS: Record<string, string> = {
  GENERATING: "Generando",
  DRAFT: "Borrador",
  VALIDATING: "Validando",
  COMPLETED: "Validada",
  REFINING: "Refinando",
  IMPROVING: "Mejorando",
  POLISHING: "Puliendo",
  FAILED: "Error",
  // Legacy
  DONE: "Validada",
  PENDING: "Pendiente",
  RUNNING: "En progreso",
  KILLED: "Cancelada",
};

/** @deprecated usar STATUS_LABELS */
export const VALIDATION_STATUS_LABELS = STATUS_LABELS;

/** Verdict → Tailwind color classes */
export const VERDICT_COLORS: Record<string, string> = {
  Adelante: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  GO: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  "Pulir idea": "text-blue-400 bg-blue-500/10 border-blue-500/30",
  PIVOT: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  "No viable": "text-red-400 bg-red-500/10 border-red-500/30",
  KILL: "text-red-400 bg-red-500/10 border-red-500/30",
  Revisar: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  Revisa: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  ITERATE: "text-orange-400 bg-orange-500/10 border-orange-500/30",
};

/** Status → Tailwind color classes */
export const STATUS_COLORS: Record<string, string> = {
  GENERATING: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  DRAFT: "text-slate-300 bg-slate-500/10 border-slate-500/30",
  VALIDATING: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  COMPLETED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  REFINING: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  IMPROVING: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  POLISHING: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  FAILED: "text-red-400 bg-red-500/10 border-red-500/30",
  // Legacy mappings
  DONE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  PENDING: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  RUNNING: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  KILLED: "text-red-400 bg-red-500/10 border-red-500/30",
};

/** Traduce un veredicto (GO, PIVOT, KILL, ITERATE) al español */
export function translateVerdict(verdict: string | null): string {
  if (!verdict) return "";
  return VERDICT_LABELS[verdict] ?? verdict;
}

/** Traduce un estado al español */
export function translateStatus(status: string | null): string {
  if (!status) return "";
  return STATUS_LABELS[status] ?? status;
}

/** Obtiene el color de badge para un veredicto */
export function getVerdictColor(verdict: string | null): string {
  if (!verdict) return STATUS_COLORS["DRAFT"];
  return VERDICT_COLORS[verdict] ?? "text-slate-400 bg-slate-500/10 border-slate-500/30";
}

/** Obtiene el color y label para un status badge */
export function getBadgeInfo(
  verdict: string | null,
  validationStatus: string,
  status: string
): { label: string; color: string; showSpinner: boolean } {
  if (verdict) {
    return {
      label: translateVerdict(verdict),
      color: getVerdictColor(verdict),
      showSpinner: false,
    };
  }

  const displayStatus = status || validationStatus;
  const showSpinner =
    displayStatus === "VALIDATING" ||
    displayStatus === "RUNNING" ||
    displayStatus === "GENERATING";

  return {
    label: translateStatus(displayStatus),
    color: STATUS_COLORS[displayStatus] ?? STATUS_COLORS["DRAFT"],
    showSpinner,
  };
}

/**
 * Get the color class for the numeric score badge.
 *
 * The score number is intentionally rendered in a neutral color so it
 * doesn't compete with the verdict badge. The verdict (Adelante /
 * Pulir idea / Revisar / No viable) carries the only color signal —
 * what to do with the idea.
 */
export function getScoreColor(_score: number): string {
  return "text-slate-300";
}

/**
 * Estado REAL del ciclo de vida de una idea para el chip de la tarjeta,
 * combinando `status` (enum) y `validationStatus`. No es el veredicto: es en qué
 * punto está la idea. Spinner para los estados "ocupados" (hay un job corriendo).
 */
export function getIdeaLifecycleBadge(
  status: string,
  validationStatus: string,
): { label: string; color: string; showSpinner: boolean } {
  const C = STATUS_COLORS;
  if (status === "GENERATING")
    return { label: "Generando", color: C.GENERATING, showSpinner: true };
  if (status === "VALIDATING" || validationStatus === "RUNNING")
    return { label: "Validando", color: C.VALIDATING, showSpinner: true };
  if (status === "REFINING")
    return { label: "Refinando", color: C.REFINING, showSpinner: true };
  if (status === "IMPROVING")
    return { label: "Mejorando", color: C.IMPROVING, showSpinner: true };
  if (status === "FAILED")
    return { label: "Error", color: C.FAILED, showSpinner: false };
  if (validationStatus === "DONE" || status === "COMPLETED")
    return { label: "Validada", color: C.COMPLETED, showSpinner: false };
  return { label: "Borrador", color: C.DRAFT, showSpinner: false };
}
