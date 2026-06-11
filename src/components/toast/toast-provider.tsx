"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { Severity } from "@/lib/user-messages";
import { Toast } from "./toast";
import {
  createToastId,
  DEFAULT_TOAST_DURATION_MS,
  toastQueueReducer,
  type ToastItem,
} from "./toast-queue";

/** Opciones para mostrar un toast (Notificación emergente). */
export interface ShowToastOptions {
  severity: Severity;
  text: string;
  title?: string;
  /** Duración del auto-cierre en ms; por defecto ~5 s. 0 = no auto-cerrar. */
  durationMs?: number;
}

export interface ToastContextValue {
  /** Muestra un toast y devuelve su id (para poder descartarlo manualmente). */
  showToast: (options: ShowToastOptions) => string;
  /** Descarta un toast por id. */
  dismissToast: (id: string) => void;
  /** Descarta todos los toasts. */
  clearToasts: () => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * ToastProvider — Provee la cola de toasts y los renderiza en una región
 * fija superpuesta (overlay). Es un componente cliente ("use client") y se
 * monta envolviendo el árbol del dashboard.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastQueueReducer, [] as ToastItem[]);

  const showToast = useCallback((options: ShowToastOptions): string => {
    const id = createToastId();
    dispatch({
      type: "add",
      toast: {
        id,
        severity: options.severity,
        text: options.text,
        title: options.title,
        durationMs: options.durationMs ?? DEFAULT_TOAST_DURATION_MS,
      },
    });
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: "remove", id });
  }, []);

  const clearToasts = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, dismissToast, clearToasts }),
    [showToast, dismissToast, clearToasts]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Región de toasts: esquina inferior derecha, apilada. */}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        aria-label="Notificaciones"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
