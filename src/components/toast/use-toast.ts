"use client";

import { useContext, useMemo } from "react";
import { getUserMessage } from "@/lib/user-messages";
import {
  ToastContext,
  type ShowToastOptions,
  type ToastContextValue,
} from "./toast-provider";

export interface UseToastReturn extends ToastContextValue {
  /** Muestra un toast (Notificación emergente) de error (rojo). */
  showError: (text: string, title?: string) => string;
  /** Muestra un toast de advertencia (ámbar). */
  showWarning: (text: string, title?: string) => string;
  /** Muestra un toast informativo (azul). */
  showInfo: (text: string, title?: string) => string;
  /**
   * Muestra un toast a partir de una categoría conocida usando
   * getUserMessage() de user-messages.ts (severidad, título y texto).
   */
  showErrorByCategory: (
    category: string,
    overrides?: Partial<ShowToastOptions>
  ) => string;
}

/**
 * useToast() — Hook para emitir toasts desde cualquier componente cliente
 * descendiente de <ToastProvider>. Expone showToast y helpers por severidad.
 */
export function useToast(): UseToastReturn {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast() debe usarse dentro de <ToastProvider>. Móntalo en el layout."
    );
  }

  const { showToast, dismissToast, clearToasts } = ctx;

  return useMemo<UseToastReturn>(
    () => ({
      showToast,
      dismissToast,
      clearToasts,
      showError: (text, title) =>
        showToast({ severity: "error", text, title }),
      showWarning: (text, title) =>
        showToast({ severity: "warning", text, title }),
      showInfo: (text, title) => showToast({ severity: "info", text, title }),
      showErrorByCategory: (category, overrides) => {
        const msg = getUserMessage(category);
        return showToast({
          severity: msg.severity,
          title: msg.title,
          text: msg.text,
          ...overrides,
        });
      },
    }),
    [showToast, dismissToast, clearToasts]
  );
}
