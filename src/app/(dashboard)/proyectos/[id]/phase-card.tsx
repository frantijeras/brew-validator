"use client";

import * as React from "react";
import { Download, FileText, Loader2 } from "lucide-react";

/**
 * PhaseCard — Tarjeta rediseñada (v3 icon + spinner) para una fase del
 * proyecto o la validación de idea. Estructura visual:
 *
 *  MÓVIL (< 768px) — layout vertical apilado
 *  ┌────────────────────────────────────────┐
 *  │  ┌────┐                                │
 *  │  │ 01 │  Título de la fase        🎨  │  ← número hero 40x40 + icono inline (md:hidden)
 *  │  └────┘                                │
 *  │  Generando análisis... ~2-3 min        │  ← solo si isProcessing
 *  │  [StatusBadge]                         │  ← badge debajo
 *  │  Descripción con leading-relaxed      │
 *  │                                        │
 *  │  [📄 artefacto-1.md]                   │  ← artefactos en columna
 *  │  [📄 preview.html]                     │
 *  │  ──────────────────────────────────    │
 *  │  [    Acción primaria   ]              │  ← acciones full-width
 *  │  [   Acción secundaria  ]              │
 *  └────────────────────────────────────────┘
 *
 *  DESKTOP (≥ 768px) — layout horizontal
 *  ┌────────────────────────────────────────────────────┐
 *  │  [01]  Icon  Título          [StatusBadge]        │
 *  │        Descripción breve                          │
 *  │                                                    │
 *  │  [📄 a1] [📄 a2] [📄 a3]                            │
 *  │  ────────────────────────────────────────────     │
 *  │  [Acción secundaria]       [Acción primaria]      │
 *  └────────────────────────────────────────────────────┘
 *
 *  Reglas (v3):
 *    - Mobile-first: < 768px apilado, ≥ 768px fila horizontal.
 *    - El icono de fase es SIEMPRE visible:
 *        · Móvil: `size-4` inline al lado del título.
 *        · Desktop: `size-5` al lado del número (md:block).
 *    - Durante `isProcessing` el icono se SUSTITUYE por `Loader2 animate-spin`
 *      en ambos viewports (mismo slot, mismo tamaño).
 *    - Durante `isProcessing`:
 *        · Aparece "Generando análisis..." + "~2-3 min" bajo el título.
 *        · El borde ámbar cambia a `border-amber-500/40` y la tarjeta
 *          recibe `animate-pulse` (pulso sutil, siempre activo —
 *          `prefers-reduced-motion` NO se respeta por decisión de Fran).
 *    - Si NO hay acciones, el bloque inferior no se renderiza.
 *    - Las acciones hijas se envuelven automáticamente en
 *      `w-full md:w-auto` para que ocupen el ancho en móvil.
 *    - Si hay 1 sola acción, se alinea a la izquierda;
 *      si hay 2+, primary a la derecha (`justify-between`).
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

const toneNumberStyles: Record<PhaseCardTone, string> = {
  blue: "bg-blue-500/10 text-blue-400",
  purple: "bg-purple-500/10 text-purple-400",
  green: "bg-green-500/10 text-green-400",
  amber: "bg-amber-500/10 text-amber-400",
  slate: "bg-slate-800 text-slate-400",
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
  // v3: durante processing el icono se sustituye por un spinner
  // y el borde ámbar recibe un pulso sutil.
  const isProcessing = status === "processing";

  // Aplanar fragments para contar y envolver acciones hijas.
  // Los consumidores pasan `<>...</>` con varios buttons, por lo que
  // necesitamos aplanar para detectar cuántos botones reales hay.
  const flatActions: React.ReactNode[] = [];
  React.Children.forEach(actions, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      React.Children.forEach(
        (child.props as { children?: React.ReactNode }).children,
        (grandChild) => {
          if (React.isValidElement(grandChild)) {
            flatActions.push(grandChild);
          }
        }
      );
    } else {
      flatActions.push(child);
    }
  });
  const hasMultipleActions = flatActions.length > 1;

  return (
    <div
      className={`rounded-xl border p-6 transition-all hover:border-slate-600 md:p-5 lg:p-6 ${
        isProcessing ? "border-amber-500/40 animate-pulse" : toneBorderStyles[tone]
      } ${toneBgStyles[tone]} ${
        isInactive ? "opacity-60" : ""
      }`}
    >
      {/* Cabecera: hero (número + icono) + content (título + badge + descripción) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-3">
        {/* Hero block: número grande a la izquierda + icono (desktop) */}
        <div className="flex items-start gap-4 md:items-center md:gap-3">
          <span
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold tracking-wider md:h-6 md:w-6 md:rounded-md md:text-[10px] ${toneNumberStyles[tone]}`}
          >
            {String(number).padStart(2, "0")}
          </span>
          {/* Icono de fase — solo desktop. Se sustituye por Loader2 durante processing. */}
          <div
            className={`hidden shrink-0 md:block ${
              isProcessing ? "text-amber-400" : toneIconStyles[tone]
            }`}
          >
            {isProcessing ? (
              <Loader2 className="size-5 animate-spin" aria-label="Procesando..." />
            ) : (
              icon
            )}
          </div>
        </div>

        {/* Content block: título + icono inline (mobile) + badge + descripción */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
            <h3
              className={`min-w-0 text-lg font-medium leading-snug md:text-base md:font-semibold md:leading-tight ${
                isInactive
                  ? "text-slate-500"
                  : status === "completed"
                    ? "text-green-300"
                    : "text-white"
              }`}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate">{title}</span>
                {/* Icono de fase — solo mobile, inline al final del título.
                    Se sustituye por Loader2 durante processing. */}
                <span
                  className={`shrink-0 md:hidden ${
                    isProcessing ? "text-amber-400" : toneIconStyles[tone]
                  }`}
                >
                  {isProcessing ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-label="Procesando..."
                    />
                  ) : (
                    icon
                  )}
                </span>
              </span>
            </h3>
            <span
              className={`inline-flex w-fit shrink-0 items-center gap-1 self-start rounded-full border px-2.5 py-0.5 text-[11px] font-medium md:w-auto ${badge.className}`}
            >
              {statusLabel || badge.label}
            </span>
          </div>

          {/* Indicador de progreso: spinner + texto + ETA. Solo durante processing. */}
          {isProcessing && (
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-400/80">
              <Loader2
                className="size-3 shrink-0 animate-spin"
                aria-hidden="true"
              />
              <span>Generando análisis...</span>
              <span className="text-amber-400/60">~2-3 min</span>
            </div>
          )}

          {description && (
            <p
              className={`mt-3 text-sm leading-relaxed md:mt-1 md:leading-snug ${
                isInactive ? "text-slate-600" : "text-slate-400"
              }`}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Artefactos: chips clickables (columna en móvil, fila en desktop) */}
      {hasArtifacts && (
        <div className="mt-5 flex flex-col gap-2 md:mt-4 md:flex-row md:flex-wrap">
          {artifacts.map((a, i) => (
            <a
              key={i}
              href={a.href}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/60 hover:border-slate-600 hover:text-white md:px-2.5 md:py-1 md:text-xs"
            >
              {a.title.toLowerCase().endsWith(".html") ? (
                <FileText className="size-3.5 md:size-3" />
              ) : (
                <Download className="size-3.5 md:size-3" />
              )}
              {a.title}
            </a>
          ))}
        </div>
      )}

      {/* Acciones: debajo del separador */}
      {hasActions && (
        <div className="mt-5 border-t border-slate-800/60 pt-5 md:mt-4 md:pt-4">
          <div
            className={`flex flex-col gap-3 md:flex-row md:items-center ${
              hasMultipleActions
                ? "md:justify-between"
                : "md:justify-start"
            }`}
          >
            {flatActions.map((action, i) => (
              <div key={i} className="w-full md:w-auto">
                {action}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
