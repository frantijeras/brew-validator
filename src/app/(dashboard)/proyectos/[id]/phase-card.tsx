"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";

/**
 * PhaseCard — Tarjeta rediseñada (v2) para una fase del proyecto o la
 * validación de idea. Estructura visual:
 *
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  01   Título de la fase                       [Status]   │  ← numeración + título + badge
 *  │       Descripción corta de qué cubre esta fase            │  ← descripción
 *  │                                                          │
 *  │       [📄 artefacto-1.md]  [📄 preview.html]              │  ← chips de artefactos (si hay)
 *  │                                                          │
 *  │       ──────────────────────────────────────────────     │  ← separador
 *  │                                                          │
 *  │       [Acción primaria]  [Acción secundaria]              │  ← acciones abajo
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Reglas:
 *    - En móvil el separador + acciones van full-width.
 *    - El estado es un badge semántico arriba a la derecha, no un pill suelto.
 *    - Las acciones se renderizan en el orden en que se pasan. Primary
 *      primero (a la izquierda), secondary después (a la derecha).
 *    - Si NO hay acciones, el bloque inferior no se renderiza.
 */

export type PhaseCardStatus =
  | "available"
  | "questioning"
  | "processing"
  | "substep"
  | "completed"
  | "locked";

export type PhaseCardTone = "blue" | "purple" | "green" | "amber" | "slate";

type Artifact = {
  title: string;
  href: string;
};

const statusBadgeStyles: Record<
  PhaseCardStatus,
  { label: string; className: string }
> = {
  available: {
    label: "Disponible",
    className:
      "border-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  questioning: {
    label: "Pendiente de respuesta",
    className:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
  processing: {
    label: "Procesando",
    className:
      "border-amber-500/30 bg-amber-500/15 text-amber-300",
  },
  substep: {
    label: "Listo para revisar",
    className:
      "border-purple-500/30 bg-purple-500/15 text-purple-300",
  },
  completed: {
    label: "Completado",
    className:
      "border-green-500/20 bg-green-500/10 text-green-300",
  },
  locked: {
    label: "Bloqueado",
    className:
      "border-slate-700 bg-slate-800 text-slate-400",
  },
};

const toneIconStyles: Record<PhaseCardTone, string> = {
  blue: "text-blue-400",
  purple: "text-purple-400",
  green: "text-green-400",
  amber: "text-amber-400",
  slate: "text-slate-400",
};

const toneBorderStyles: Record<PhaseCardTone, string> = {
  blue: "border-blue-500/20",
  purple: "border-purple-500/20",
  green: "border-green-500/20",
  amber: "border-amber-500/20",
  slate: "border-slate-700",
};

const toneBgStyles: Record<PhaseCardTone, string> = {
  blue: "bg-blue-950/5",
  purple: "bg-purple-950/5",
  green: "bg-green-950/5",
  amber: "bg-amber-950/5",
  slate: "bg-slate-900/40",
};

export interface PhaseCardProps {
  /** Número de fase (0 para la validación de idea, 1-6 para las fases del proyecto). */
  number: number;
  title: string;
  description?: string | null;
  icon: React.ReactNode;
  status: PhaseCardStatus;
  /** Tono del color principal (afecta al icono, borde y fondo sutil). */
  tone: PhaseCardTone;
  /** Artefactos generados. Cada uno se renderiza como un chip clickable que descarga. */
  artifacts?: Artifact[];
  /** Acciones a renderizar debajo del separador. Si está vacío, no se muestra el bloque. */
  actions?: React.ReactNode;
  /** Etiqueta alternativa para el badge de estado (ej. "Información" para la fase 0). */
  statusLabel?: string;
}

export function PhaseCard({
  number,
  title,
  description,
  icon,
  status,
  tone,
  artifacts,
  actions,
  statusLabel,
}: PhaseCardProps) {
  const badge = statusBadgeStyles[status];
  const hasArtifacts = artifacts && artifacts.length > 0;
  const hasActions = React.Children.count(actions) > 0;
  const isInactive = status === "locked";

  return (
    <div
      className={`rounded-xl border p-5 transition-all hover:border-slate-600 ${
        toneBorderStyles[tone]
      } ${toneBgStyles[tone]} ${
        isInactive ? "opacity-60" : ""
      }`}
    >
      {/* Cabecera: número + título + icono, badge de estado a la derecha */}
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 items-center gap-2.5">
          <span
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-[10px] font-semibold tracking-wider ${
              tone === "green"
                ? "bg-green-500/10 text-green-400"
                : tone === "amber"
                  ? "bg-amber-500/10 text-amber-400"
                  : tone === "purple"
                    ? "bg-purple-500/10 text-purple-400"
                    : tone === "blue"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-slate-800 text-slate-400"
            }`}
          >
            {String(number).padStart(2, "0")}
          </span>
          <div className={toneIconStyles[tone]}>{icon}</div>
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`text-base font-semibold leading-tight ${
              isInactive
                ? "text-slate-500"
                : status === "completed"
                  ? "text-green-300"
                  : "text-white"
            }`}
          >
            {title}
          </h3>
          {description && (
            <p
              className={`mt-1 text-sm leading-snug ${
                isInactive ? "text-slate-600" : "text-slate-400"
              }`}
            >
              {description}
            </p>
          )}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 self-start rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}
        >
          {statusLabel || badge.label}
        </span>
      </div>

      {/* Artefactos: chips clickables */}
      {hasArtifacts && (
        <div className="mt-4 flex flex-wrap gap-2">
          {artifacts.map((a, i) => (
            <a
              key={i}
              href={a.href}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/60 hover:border-slate-600 hover:text-white"
            >
              {a.title.toLowerCase().endsWith(".html") ? (
                <FileText className="size-3" />
              ) : (
                <Download className="size-3" />
              )}
              {a.title}
            </a>
          ))}
        </div>
      )}

      {/* Acciones: debajo del separador */}
      {hasActions && (
        <>
          <div className="my-4 border-t border-slate-800/60" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
            {actions}
          </div>
        </>
      )}
    </div>
  );
}
