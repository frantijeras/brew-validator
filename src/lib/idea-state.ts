import { IdeaStatus } from "@prisma/client";

/**
 * Estados en los que la idea está siendo procesada por un agente del bridge.
 * Bloquean acciones de mutación de contenido (validar, refinar, renombrar,
 * editar campos) para evitar jobs duplicados y pisado de datos.
 */
export const BLOCKING_STATUSES: readonly IdeaStatus[] = [
  "GENERATING",
  "VALIDATING",
  "REFINING",
  "IMPROVING",
  "POLISHING",
] as const;

/** ¿La idea está siendo procesada por el bridge en este momento? */
export function isIdeaBusy(status: string | null | undefined): boolean {
  return BLOCKING_STATUSES.includes(status as IdeaStatus);
}

/** ¿Se puede editar el contenido de la idea (no metadatos)? */
export function canEditIdeaContent(status: string | null | undefined): boolean {
  return !isIdeaBusy(status);
}
