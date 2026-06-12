"use client";

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import type { Severity } from "@/lib/user-messages";
import type { ToastItem } from "./toast-queue";

/**
 * Mapeo de severidad a clases Tailwind concretas e icono.
 * rojo = error (crítico), ámbar = warning (advertencia), azul = info.
 */
const SEVERITY_STYLES: Record<
  Severity,
  { container: string; icon: string; Icon: typeof Info; role: "alert" | "status" }
> = {
  error: {
    container: "border-red-500/40 bg-red-950/90",
    icon: "text-red-400",
    Icon: AlertCircle,
    role: "alert",
  },
  warning: {
    container: "border-amber-500/40 bg-amber-950/90",
    icon: "text-amber-400",
    Icon: AlertTriangle,
    role: "status",
  },
  info: {
    container: "border-blue-500/40 bg-blue-950/90",
    icon: "text-blue-400",
    Icon: Info,
    role: "status",
  },
};

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

/**
 * Toast (Notificación emergente) individual con animación de entrada/salida,
 * auto-cierre configurable y botón de cierre manual. Accesible.
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const { id, severity, text, title, durationMs } = toast;
  const style = SEVERITY_STYLES[severity];
  const { Icon } = style;

  // Estado de visibilidad para animar entrada y salida.
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Animación de entrada en el primer frame tras el montaje.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-cierre tras durationMs (si es > 0).
  useEffect(() => {
    if (durationMs <= 0) return;
    const timer = setTimeout(() => beginDismiss(), durationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  /** Inicia la transición de salida y luego notifica al provider. */
  function beginDismiss() {
    setLeaving(true);
    setTimeout(() => onDismiss(id), 200);
  }

  return (
    <div
      role={style.role}
      aria-live={severity === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-200 ease-out " +
        style.container +
        " " +
        (visible && !leaving
          ? "translate-y-0 opacity-100"
          : "translate-y-2 opacity-0")
      }
    >
      <Icon className={"mt-0.5 size-5 shrink-0 " + style.icon} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        {title && (
          <p className="text-sm font-semibold text-slate-100">{title}</p>
        )}
        <p className="break-words text-sm text-slate-300">{text}</p>
      </div>

      <button
        type="button"
        onClick={beginDismiss}
        className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
        aria-label="Cerrar notificación"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
