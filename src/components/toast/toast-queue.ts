/**
 * toast-queue.ts — Lógica pura de la cola de toasts (Notificación emergente).
 *
 * Reducer sin dependencias de React ni del DOM, de modo que sea testeable de
 * forma aislada (ver scripts/smoke-e2e.ts). El Provider envuelve este reducer.
 */

import type { Severity } from "@/lib/user-messages";

/** Duración por defecto del auto-cierre, en milisegundos (~5 s). */
export const DEFAULT_TOAST_DURATION_MS = 5000;

/** Máximo de toasts visibles a la vez (apilado controlado). */
export const MAX_TOASTS = 4;

export interface ToastItem {
  id: string;
  severity: Severity;
  text: string;
  title?: string;
  /** Duración del auto-cierre; 0 o negativo = no auto-cerrar. */
  durationMs: number;
}

export type ToastAction =
  | { type: "add"; toast: ToastItem }
  | { type: "remove"; id: string }
  | { type: "clear" };

/**
 * Reducer puro de la cola. Inserta los toasts más recientes al principio y
 * recorta la cola a MAX_TOASTS descartando los más antiguos.
 */
export function toastQueueReducer(
  state: ToastItem[],
  action: ToastAction
): ToastItem[] {
  switch (action.type) {
    case "add": {
      // Evita duplicar un id ya presente (idempotente).
      const without = state.filter((t) => t.id !== action.toast.id);
      return [action.toast, ...without].slice(0, MAX_TOASTS);
    }
    case "remove":
      return state.filter((t) => t.id !== action.id);
    case "clear":
      return [];
    default:
      return state;
  }
}

/** Genera un id único para un toast (sin dependencias externas). */
export function createToastId(): string {
  return `toast-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
