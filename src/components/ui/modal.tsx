"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

/**
 * Modal — diálogo base del design system. Sustituye los overlays montados a
 * mano (con z-index y backdrop divergentes). Centraliza:
 *  - overlay + backdrop + click-fuera para cerrar,
 *  - cierre con tecla Escape y bloqueo de scroll del body,
 *  - cabecera con título e icono de cierre (X),
 *  - pie con orden canónico: acción primaria a la DERECHA (usa ModalFooter).
 */
export type ModalSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Icono opcional junto al título. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Contenido del pie (botones). Usa orden [secundario, primario]. */
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Oculta el botón de cierre (X) en la cabecera. */
  hideClose?: boolean;
  /** Altura máxima alta con cuerpo scrollable. */
  tall?: boolean;
  /** z-index personalizado (por defecto 50). */
  zClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  size = "md",
  hideClose,
  tall,
  zClassName = "z-50",
}: ModalProps) {
  // Cerrar con Escape + bloquear scroll del body mientras está abierto.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm",
        zClassName
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "flex w-full flex-col rounded-xl border border-line-strong bg-slate-900 shadow-xl",
          sizes[size],
          tall && "max-h-[85vh]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || !hideClose) && (
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
            <h3 className="flex items-center gap-2 truncate text-base font-semibold text-white">
              {icon}
              {title}
            </h3>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}

        <div className={cn("px-5 py-4", tall && "min-h-0 flex-1 overflow-y-auto")}>
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-line px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
