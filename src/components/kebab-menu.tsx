"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";

export interface KebabItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  /** Acción peligrosa (rojo). */
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Menú de 3 puntos. Se coloca a la derecha del badge de estado de cada fase /
 * sub-fase y agrupa las acciones secundarias (Descargar, Rehacer). Cierra al
 * hacer click fuera o al elegir una opción.
 */
export function KebabMenu({
  items,
  ariaLabel = "Más acciones",
}: {
  items: KebabItem[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex size-7 items-center justify-center rounded-md border border-slate-700 bg-slate-800/60 text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
        >
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors disabled:opacity-50 ${
                it.danger
                  ? "text-red-300 hover:bg-red-500/10"
                  : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
