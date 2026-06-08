"use client";

import * as React from "react";
import { Check, Download, FileText, Loader2 } from "lucide-react";

/**
 * PhaseCard — Tarjeta rediseñada (v5: acciones responsive) para una fase
 * del proyecto o la validación de idea. Estructura visual:
 *
 *  MÓVIL (< 768px)
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  [    Acción primaria   ]                                │  ← acciones en columna, items-start
 *  │  [   Acción secundaria  ]                                │     ARRIBA del header
 *  │  ──────────────────────────────────────────────────────  │
 *  │  [01]  🎨  Título de la fase                             │  ← header: número → icono → título
 *  │       [StatusBadge]                                      │  ← badge en su línea, indentado
 *  │  Generando análisis... ~2-3 min                          │  ← solo si isProcessing
 *  │  Descripción con leading-relaxed                        │
 *  │                                                          │
 *  │  [📄 artefacto-1.md]                                     │  ← artefactos en columna
 *  │  [📄 preview.html]                                       │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  DESKTOP (≥ 768px)
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  [01]  🎨  Título de la fase        [Acción1] [Acción2]  │  ← header + acciones en fila,
 *  │       [StatusBadge]                                      │     acciones a la derecha (ml-auto)
 *  │  Generando análisis... ~2-3 min                          │
 *  │  Descripción con leading-relaxed                        │
 *  │                                                          │
 *  │  [📄 artefacto-1.md] [📄 preview.html]                   │  ← artefactos en fila
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Reglas (v5):
 *    - Header SIEMPRE en una sola línea: `número → icono → título`,
 *      en ese orden, en móvil y desktop, dentro de
 *      `flex flex-row items-center gap-2`.
 *    - El badge de estado se mueve FUERA del flex-row del header y se
 *      renderiza en su propia línea, indentado con `ml-2` para alinearse
 *      bajo el título. Esto libera la fila del header para las acciones
 *      en desktop.
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
 *    - Si NO hay acciones, el bloque superior no se renderiza.
 *    - Layout de las acciones (v5 — responsive):
 *        · Móvil: columna, alineadas a la izquierda (`items-start gap-2`),
 *          renderizadas ANTES del header, con un separador `border-b`
 *          debajo.
 *        · Desktop: fila, alineadas a la derecha (`md:ml-auto md:items-center
 *          md:justify-end md:gap-2`), en la MISMA línea que el header.
 *    - Las acciones hijas se envuelven automáticamente en
 *      `w-full md:w-auto` para que ocupen el ancho en móvil.
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
  /**
   * Barra de sub-progreso (ej. IDENTITY: "1/4 Nombre", "2/4 Voz y Tono", ...).
   * Cuando se pasa, se renderiza justo bajo el badge, mostrando checkmarks
   * en los items "done" y resaltando el item "current". Solo se muestra si
   * la fase NO está completed y locked.
   */
  subProgress?: Array<{ label: string; status: "done" | "current" | "pending" }>;
  /**
   * Mini barra horizontal de progreso (ej. 4 segmentos para IDENTITY).
   * Cuando se pasa, se renderiza encima del description (o debajo si no
   * hay description), con una animación pulse en el segmento activo.
   */
  miniProgressBar?: React.ReactNode;
  /**
   * Sub-step cards a renderizar debajo de la descripción y antes de las
   * acciones globales. Se renderizan en un contenedor con mt-4 space-y-2.
   */
  subSteps?: React.ReactNode;
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
  subProgress,
  miniProgressBar,
  subSteps,
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

  // Aplanar fragments para envolver acciones hijas.
  // Los consumidores pasan `<>...</>` con varios buttons, por lo que
  // necesitamos aplanar para iterar uniformemente.
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

  return (
    <div
      className={`rounded-xl border p-6 transition-all hover:border-slate-600 md:p-5 lg:p-6 ${
        isProcessing ? "border-amber-500/40" : toneBorderStyles[tone]
      } ${toneBgStyles[tone]} ${
        isInactive ? "opacity-60" : ""
      }`}
    >
      {/* Cabecera (v5): número → icono → título, en la misma línea.
          En desktop, las acciones se renderizan también aquí, a la derecha,
          con `md:ml-auto`. En móvil, las acciones ya se renderizaron arriba. */}
      <div
        className="flex flex-row items-center gap-2"
      >
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold tracking-wider md:h-6 md:w-6 md:rounded-md md:text-[10px] ${toneNumberStyles[tone]}`}
        >
          {String(number).padStart(2, "0")}
        </span>
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

      </div>

      {/* Badge de estado (v5): movido FUERA del flex-row del header a su
          propia línea, indentado con `ml-2` para alinearse bajo el título. */}
      <div className="mt-1 ml-2">
        <span
          className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}
        >
          {statusLabel || badge.label}
        </span>
      </div>

      {/* Sub-progress (ej. IDENTITY 1/4 Nombre, 2/4 Voz y Tono, …). Solo
          se muestra si la fase no está completada/locked y se ha pasado
          el array `subProgress`. Cada item es un chip con check (done),
          dot ámbar (current) o círculo vacío (pending). */}
      {subProgress && subProgress.length > 0 && status !== "completed" && status !== "locked" && (
        <div className="mt-2 ml-2 flex flex-wrap items-center gap-1.5">
          {subProgress.map((step, i) => {
            const isDone = step.status === "done";
            const isCurrent = step.status === "current";
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  isCurrent
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                    : isDone
                      ? "border-green-500/30 bg-green-500/10 text-green-300"
                      : "border-slate-700 bg-slate-800/60 text-slate-400"
                }`}
              >
                {isDone ? (
                  <Check className="size-3" />
                ) : isCurrent ? (
                  <span className="inline-block size-1.5 rounded-full bg-amber-400" />
                ) : (
                  <span className="inline-block size-1.5 rounded-full border border-slate-500" />
                )}
                <span>
                  {i + 1}/{subProgress.length} {step.label}
                </span>
              </span>
            );
          })}
        </div>
      )}

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

      {miniProgressBar && (
        <div className="mt-2">{miniProgressBar}</div>
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

      {/* Sub-step cards (nuevo) — renderizadas debajo de la descripción,
          antes de los artefactos y las acciones globales. */}
      {subSteps && (
        <div className="mt-4 space-y-2">
          {subSteps}
        </div>
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

      {/* Acciones — siempre al final de la tarjeta (tanto móvil como desktop).
          Móvil: columna apilada, alineadas a la izquierda, con separador
          `border-t` arriba.
          Desktop: también en columna por defecto pero con `border-t` y
          alineadas a la derecha (`md:items-end`). Si el consumidor pasa
          varios botones, se apilan verticalmente. El flex-col items-start
          garantiza que ocupen todo el ancho disponible en móvil (w-full
          heredado del wrapper del action child).
          Para mantener compatibilidad, las acciones hijas se envuelven
          en un contenedor con `w-full md:w-auto` para que en desktop
          ocupen solo su contenido. */}
      {hasActions && (
        <div className="mt-5 flex flex-col items-start gap-2 border-t border-slate-800/60 pt-5 md:flex-row md:items-center md:justify-end md:gap-3">
          {flatActions.map((action, i) => (
            <div key={i} className="w-full md:w-auto">
              {action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
