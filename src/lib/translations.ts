/** Mapeo de veredicto (DB) → etiqueta en español */
export const VERDICT_LABELS: Record<string, string> = {
  GO: "Avanza",
  PIVOT: "Pivota",
  KILL: "Cancela",
  ITERATE: "Itera",
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
