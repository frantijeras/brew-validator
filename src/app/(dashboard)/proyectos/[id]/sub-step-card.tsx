"use client";

import * as React from "react";
import {
  Lock,
  Play,
  Loader2,
  Sparkles,
  CheckCircle,
  Type,
  MessageSquare,
  Palette as PaletteIcon,
  BookOpen,
  HelpCircle,
  BriefcaseBusiness,
  LayoutGrid,
  FileText as FileTextIcon,
  GitCompare,
  Code as CodeIcon,
  PlayCircle,
  Rocket,
  AlertTriangle,
  Info,
  type LucideIcon,
} from "lucide-react";
import { type SubStepMeta } from "@/lib/phase-substeps";
import { DOMAIN_FALLBACK_MESSAGE } from "@/lib/user-messages";
import { ElapsedCounter } from "@/components/elapsed-counter";

/** Estado visual de un sub-step card. */
export type SubStepStatus =
  | "locked"
  | "available"
  | "processing"
  | "substep_ready"
  | "completed";

export interface SubStepCardProps {
  phaseType: string;
  subStepMeta: SubStepMeta;
  status: SubStepStatus;
  number: number;
  onAction?: () => void;
  tone?: string;
  reviewLabel?: string;
  executeLabel?: string;
  processingMessage?: string;
  /**
   * Instante en que el sub-paso entró en PROCESSING (normalmente
   * `phase.updatedAt`). Durante `processing` se muestra un contador de tiempo
   * en vivo `mm:ss` en lugar de una ETA fija.
   */
  processingSince?: string | number | Date | null;
  /** Mensaje de error de la última acción fallida; muestra un banner + reintento. */
  errorMessage?: string;
  /**
   * Cuando la verificación de disponibilidad de dominios viene degradada
   * (servicio caído, lento o timeout), el padre activa este flag para que
   * el sub-paso muestre un aviso de Fallback (Plan de contingencia) NO
   * bloqueante. El usuario puede seguir eligiendo/escribiendo el nombre.
   *
   * Texto: opcional; por defecto usa DOMAIN_FALLBACK_MESSAGE.text.
   */
  domainFallback?: boolean;
  /** Texto del aviso de Fallback de dominio (por defecto el mensaje estándar). */
  domainFallbackMessage?: string;
}

/**
 * Etiqueta corta del número de sub-paso IDENTITY (3a/3b/3c/3d).
 * naming=3A, voice=3B, logo=3C (Logotipo), visual=3D (Estilo Visual y Maqueta).
 */
const IDENTITY_SUBSTEP_LABELS: Record<string, string> = {
  naming: "3A",
  voice: "3B",
  logo: "3C",
  visual: "3D",
};

/** Mapa estático de nombres de iconos a componentes Lucide. */
const ICON_MAP: Record<string, LucideIcon> = {
  Type,
  MessageSquare,
  Palette: PaletteIcon,
  BookOpen,
  HelpCircle,
  BriefcaseBusiness,
  LayoutGrid,
  FileText: FileTextIcon,
  GitCompare,
  Code: CodeIcon,
  PlayCircle,
  Rocket,
};

/** Clases del número circular según el tono heredado. */
const toneNumberStyles: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-400",
  purple: "bg-purple-500/10 text-purple-400",
  green: "bg-green-500/10 text-green-400",
  amber: "bg-amber-500/10 text-amber-400",
  slate: "bg-slate-800 text-slate-400",
};

const statusBadgeConfig: Record<
  SubStepStatus,
  { label: string; className: string; Icon: LucideIcon | null }
> = {
  locked: {
    label: "Pendiente",
    className: "border-slate-700 bg-slate-800 text-slate-500",
    Icon: Lock,
  },
  available: {
    label: "",
    className: "",
    Icon: null,
  },
  processing: {
    label: "Procesando",
    className: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    Icon: Loader2,
  },
  substep_ready: {
    label: "Listo para revisar",
    className: "border-purple-500/30 bg-purple-500/15 text-purple-300",
    Icon: Sparkles,
  },
  completed: {
    label: "Completado",
    className: "border-green-500/20 bg-green-500/10 text-green-300",
    Icon: CheckCircle,
  },
};

const cardContainerStyles: Record<SubStepStatus, string> = {
  locked:
    "rounded-lg border border-slate-800/60 bg-slate-900/30 opacity-60",
  available:
    "rounded-lg border border-slate-700 bg-slate-900/70 transition-all hover:border-slate-600 hover:bg-slate-900 hover:shadow-sm",
  processing:
    "rounded-lg border border-amber-500/30 bg-amber-500/5 transition-all",
  substep_ready:
    "rounded-lg border border-purple-500/30 bg-purple-500/5 transition-all hover:border-purple-500/50 hover:bg-purple-500/10",
  completed:
    "rounded-lg border border-green-500/20 bg-green-500/5 transition-all",
};

function getNumberStyles(status: SubStepStatus, tone: string): string {
  switch (status) {
    case "locked":
      return "bg-slate-800 text-slate-500";
    case "available":
      return toneNumberStyles[tone] || toneNumberStyles.blue;
    case "processing":
      return "bg-amber-500/20 text-amber-400";
    case "substep_ready":
      return "bg-purple-500/20 text-purple-400";
    case "completed":
      return "bg-green-500/20 text-green-400";
  }
}

function getTitleStyles(status: SubStepStatus): string {
  switch (status) {
    case "locked":
      return "text-sm font-semibold text-slate-500";
    case "available":
      return "text-sm font-semibold text-white";
    case "processing":
      return "text-sm font-semibold text-amber-200";
    case "substep_ready":
      return "text-sm font-semibold text-purple-200";
    case "completed":
      return "text-sm font-semibold text-green-300";
  }
}

function getDescriptionStyles(status: SubStepStatus): string {
  switch (status) {
    case "locked":
      return "text-xs text-slate-600";
    case "available":
      return "text-xs text-slate-500";
    case "processing":
      return "text-xs text-amber-400/70";
    case "substep_ready":
      return "text-xs text-purple-400/70";
    case "completed":
      return "text-xs text-green-400/70";
  }
}

function getIconColor(status: SubStepStatus): string {
  switch (status) {
    case "locked":
      return "text-slate-600";
    case "available":
      return "text-slate-400";
    case "processing":
      return "text-amber-400";
    case "substep_ready":
      return "text-purple-400";
    case "completed":
      return "text-green-400";
  }
}

const buttonStyles: Record<string, string> = {
  available:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-slate-950 transition-all hover:bg-amber-400 active:bg-amber-600",
  substep_ready:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-500 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-purple-400 active:bg-purple-600",
  locked:
    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-500 cursor-not-allowed",
};

export function SubStepCard({
  phaseType,
  subStepMeta,
  status,
  number,
  onAction,
  tone = "blue",
  reviewLabel = "Revisar",
  executeLabel = "Iniciar",
  processingMessage = "Generando...",
  processingSince,
  errorMessage,
  domainFallback = false,
  domainFallbackMessage,
}: SubStepCardProps) {
  const badge = statusBadgeConfig[status];
  const StatusIcon = badge.Icon;
  const SubStepIcon = ICON_MAP[subStepMeta.icon] || null;

  const hasDesktopButton =
    status === "available" || status === "substep_ready";
  const showButton =
    status === "available" || status === "substep_ready";
  const buttonLabel =
    status === "available"
      ? executeLabel
      : status === "substep_ready"
        ? reviewLabel
        : "Bloqueado";

  return (
    <div
      role="region"
      aria-label={`Sub-paso ${number}: ${subStepMeta.label}`}
      className={`${cardContainerStyles[status]} p-4 md:p-3 lg:p-4 overflow-hidden`}
    >
      {/* Bloque superior: badge de estado, alineado al extremo superior
          derecho (misma estructura que la tarjeta de fase padre). En
          "processing" muestra el mensaje contextual ("Definiendo
          personalidad…", "Generando informe…") + contador de tiempo. */}
      {(status === "processing" || !!badge.label) && (
        <div className="flex items-center justify-end gap-2">
          {status === "processing" ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
              <Loader2 className="size-3 animate-spin" />
              <span>{processingMessage}</span>
              <ElapsedCounter
                since={processingSince}
                className="tabular-nums text-amber-400/70"
              />
            </span>
          ) : (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
              aria-label={`Estado: ${badge.label}`}
            >
              {StatusIcon && <StatusIcon className="size-3" />}
              {badge.label}
            </span>
          )}
        </div>
      )}

      {/* Fila central: número (cuadrado) + icono representativo + título,
          en una sola línea. El botón (desktop) se alinea a la derecha. */}
      <div
        className={`flex items-center gap-2.5 ${
          status === "processing" || badge.label ? "mt-2" : ""
        }`}
      >
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold md:h-7 md:w-7 md:text-[11px] ${getNumberStyles(status, tone)}`}
          aria-hidden="true"
        >
          {phaseType === "IDENTITY" ? IDENTITY_SUBSTEP_LABELS[subStepMeta.id] ?? String(number) : String(number)}
        </span>

        {SubStepIcon && (
          <SubStepIcon
            className={`size-4 shrink-0 ${getIconColor(status)}`}
            aria-hidden="true"
          />
        )}

        <span className={`min-w-0 flex-1 truncate ${getTitleStyles(status)}`}>
          {subStepMeta.label}
        </span>

        {hasDesktopButton && (
          <button
            onClick={onAction}
            className={`hidden md:inline-flex shrink-0 ${status === "available" ? buttonStyles.available : buttonStyles.substep_ready}`}
            aria-label={
              status === "available"
                ? `${executeLabel} ${subStepMeta.label}`
                : `${reviewLabel} ${subStepMeta.label}`
            }
          >
            {status === "available" ? (
              <Play className="size-3.5" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {buttonLabel}
          </button>
        )}
      </div>

      {/* Bloque inferior: descripción de la sub-fase (ancho completo). */}
      <p className={`mt-1.5 ${getDescriptionStyles(status)}`}>
        {subStepMeta.description}
      </p>

      {showButton && (
        <div className="mt-3 w-full md:hidden">
          <button
            onClick={onAction}
            className={`w-full ${status === "available" ? buttonStyles.available : buttonStyles.substep_ready}`}
            aria-label={
              status === "available"
                ? `${executeLabel} ${subStepMeta.label}`
                : `${reviewLabel} ${subStepMeta.label}`
            }
          >
            {status === "available" ? (
              <Play className="size-3.5" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {buttonLabel}
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p>{errorMessage}</p>
            {onAction && (
              <button
                onClick={onAction}
                className="mt-1 font-medium text-red-200 underline underline-offset-2 hover:text-white"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fallback (Plan de contingencia) de dominios: aviso NO bloqueante,
          tono ámbar-azul. Se muestra cuando la verificación de
          disponibilidad de dominio viene degradada (servicio caído, lento
          o timeout). El usuario puede continuar con el nombre igualmente. */}
      {domainFallback && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-blue-500/10 px-3 py-2 text-xs text-amber-200"
        >
          <Info className="size-3.5 shrink-0 mt-0.5 text-blue-300" />
          <p className="flex-1 min-w-0 leading-relaxed">
            {domainFallbackMessage || DOMAIN_FALLBACK_MESSAGE.text}
          </p>
        </div>
      )}
    </div>
  );
}
