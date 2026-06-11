/**
 * Barrel del sistema de Toast (Notificación emergente) — Feedback Capa 1.
 */

export { ToastProvider, ToastContext } from "./toast-provider";
export type {
  ShowToastOptions,
  ToastContextValue,
} from "./toast-provider";
export { useToast } from "./use-toast";
export type { UseToastReturn } from "./use-toast";
export { Toast } from "./toast";
export {
  toastQueueReducer,
  createToastId,
  DEFAULT_TOAST_DURATION_MS,
  MAX_TOASTS,
} from "./toast-queue";
export type { ToastItem, ToastAction } from "./toast-queue";
