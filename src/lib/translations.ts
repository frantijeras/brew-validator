/** Mapeo de veredicto (DB) → etiqueta en español */
export const VERDICT_LABELS: Record<string, string> = {
  GO: "Adelante",
  PIVOT: "Redirige",
  KILL: "Detén",
  ITERATE: "Revisa",
  // Spanish equivalents (from agents)
  Adelante: "Adelante",
  Redirige: "Redirige",
  "Detén": "Detén",
  Revisa: "Revisa",
};

/** Mapeo de estado de validación (DB) → etiqueta en español */
export const VALIDATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  RUNNING: "En progreso",
  COMPLETED: "Completado",
  FAILED: "Falló",
  VALIDATING: "Validando",
  DONE: "Finalizado",
  GENERATING: "Generando",
  KILLED: "Cancelado",
};

/** Verdict → Tailwind color classes */
export const VERDICT_COLORS: Record<string, string> = {
  Adelante: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  GO: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  Redirige: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  PIVOT: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  "Detén": "text-red-400 bg-red-500/10 border-red-500/30",
  KILL: "text-red-400 bg-red-500/10 border-red-500/30",
  Revisa: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  ITERATE: "text-blue-400 bg-blue-500/10 border-blue-500/30",
};

/** Status → Tailwind color classes */
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  COMPLETED: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  DONE: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  PENDING: "text-slate-400 bg-slate-500/10 border-slate-500/30",
  VALIDATING: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  RUNNING: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  GENERATING: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  FAILED: "text-red-400 bg-red-500/10 border-red-500/30",
  KILLED: "text-red-400 bg-red-500/10 border-red-500/30",
};

/** Traduce un veredicto (GO, PIVOT, KILL, ITERATE) al español */
export function translateVerdict(verdict: string | null): string {
  if (!verdict) return "";
  return VERDICT_LABELS[verdict] ?? verdict;
}

/** Traduce un estado (DRAFT, PENDING, RUNNING, …) al español */
export function translateStatus(status: string | null): string {
  if (!status) return "";
  return VALIDATION_STATUS_LABELS[status] ?? status;
}

/** Obtiene el color de badge para un veredicto */
export function getVerdictColor(verdict: string | null): string {
  if (!verdict) return STATUS_COLORS["DRAFT"];
  return VERDICT_COLORS[verdict] ?? "text-slate-400 bg-slate-500/10 border-slate-500/30";
}

/** Obtiene el color y label para el badge único (veredicto > estado) */
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

  const effectiveStatus = validationStatus || status;
  const showSpinner =
    effectiveStatus === "RUNNING" ||
    effectiveStatus === "VALIDATING" ||
    effectiveStatus === "GENERATING";

  return {
    label: translateStatus(effectiveStatus),
    color: STATUS_COLORS[effectiveStatus] ?? STATUS_COLORS["DRAFT"],
    showSpinner,
  };
}
