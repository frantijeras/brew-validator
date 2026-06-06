"use client";

import * as React from "react";
import { Download, FileText, Loader2 } from "lucide-react";

/**
 * PhaseCard — Tarjeta rediseñada (v4: header inline + sin parpadeo) para
 * una fase del proyecto o la validación de idea. Estructura visual:
 *
 *  MÓVIL (< 768px) y DESKTOP (≥ 768px) — header en una sola línea
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  [01]  🎨  Título de la fase              [StatusBadge] │  ← número → icono → título, todos en `flex-row items-center gap-2`
 *  │  Generando análisis... ~2-3 min                          │  ← solo si isProcessing
 *  │  Descripción con leading-relaxed                        │
 *  │                                                          │
 *  │  [📄 artefacto-1.md]                                     │  ← artefactos en columna (móvil) / fila (desktop)
 *  │  [📄 preview.html]                                       │
 *  │  ──────────────────────────────────────────────────────  │
 *  │  [    Acción primaria   ]                                │  ← acciones full-width en móvil
 *  │  [   Acción secundaria  ]                                │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Reglas (v4):
 *    - Header SIEMPRE en una sola línea: `número → icono → título`,
 *      en ese orden, en móvil y desktop, dentro de
 *      `flex flex-row items-center gap-2`.
 *    - El icono de fase es SIEMPRE visible:
 *        · Móvil: `size-4`.
 *        · Desktop: `size-5` (vía `md:size-5` en el wrapper del icono).
 *    - Durante `isProcessing` el icono se SUSTITUYE por `Loader2 animate-spin`
 *      en el mismo slot y tamaño.
 *    - Durante `isProcessing`:
 *        · Aparece "Generando análisis..." + "~2-3 min" bajo el header.
 *        · El borde ámbar cambia a `border-amber-500/40` PERO SIN animación
 *          de opacidad (sin `animate-pulse`). El feedback "está vivo" lo
 *          dan el spinner y el texto "Generando...".
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
  // v4: durante processing el icono se sustituye por un spinner.
  // El borde ámbar se mantiene (`border-amber-500/40`) pero SIN
  // `animate-pulse` — el feedback de "está vivo" lo dan el spinner
  // y el texto "Generando análisis..." bajo el header.
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
        isProcessing ? "border-amber-500/40" : toneBorderStyles[tone]
      } ${toneBgStyles[tone]} ${
        isInactive ? "opacity-60" : ""
      }`}
    >
      {/* Cabecera (v4): número → icono → título, TODO en la misma línea.
          Móvil y desktop usan el mismo `flex flex-row items-center gap-2`.
          El badge se empuja a la derecha con `ml-auto`. */}
      <div className="flex flex-row items-center gap-2">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold tracking-wider md:h-6 md:w-6 md:rounded-md md:text-[10px] ${toneNumberStyles[tone]}`}
        >
          {String(number).padStart(2, "0")}
        </span>
        {/* Icono de fase — siempre visible. Se sustituye por Loader2 durante processing.
            Tamaño: size-4 en móvil, size-5 en desktop (md:size-5). */}
        <div
          className={`shrink-0 ${
            isProcessing ? "text-amber-400" : toneIconStyles[tone]
          }`}
        >
          {isProcessing ? (
            <Loader2
              className="size-4 animate-spin md:size-5"
              aria-label="Procesando..."
            />
          ) : (
            <>
              {/* Móvil: reescalar el icono del consumer a size-4. */}
              <span className="block md:hidden [&_svg]:!h-4 [&_svg]:!w-4">
                {icon}
              </span>
              {/* Desktop: icono en su tamaño original (size-5). */}
              <span className="hidden md:inline-flex">{icon}</span>
            </>
          )}
        </div>
        <h3
          className={`min-w-0 flex-1 truncate text-lg font-medium leading-snug md:text-base md:font-semibold md:leading-tight ${
            isInactive
              ? "text-slate-500"
              : status === "completed"
                ? "text-green-300"
                : "text-white"
          }`}
        >
          {title}
        </h3>
        <span
          className={`ml-auto inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}
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
          className={`mt-3 text-sm leading-relaxed md:mt-2 md:leading-snug ${
            isInactive ? "text-slate-600" : "text-slate-400"
          }`}
        >
          {description}
        </p>
      )}

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
