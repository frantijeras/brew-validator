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
  type LucideIcon,
} from "lucide-react";
import { type SubStepMeta } from "@/lib/phase-substeps";

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
  processingEta?: string;
}

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
  phaseType: _phaseType,
  subStepMeta,
  status,
  number,
  onAction,
  tone = "blue",
  reviewLabel = "Revisar",
  executeLabel = "Ejecutar",
  processingMessage = "Generando...",
  processingEta = "~2-3 min",
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

  const badgeIconAnimate =
    status === "processing" ? "animate-spin" : "";

  return (
    <div
      role="region"
      aria-label={`Sub-paso ${number}: ${subStepMeta.label}`}
      className={`${cardContainerStyles[status]} p-4 md:p-3 lg:p-4 overflow-hidden`}
    >
      {/* Header: número + icono + título + badge + botón (desktop) */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${getNumberStyles(status, tone)}`}
          aria-hidden="true"
        >
          {number}
        </span>

        {SubStepIcon && (
          <SubStepIcon
            className={`size-4 shrink-0 ${getIconColor(status)}`}
            aria-hidden="true"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={getTitleStyles(status)}>
              {subStepMeta.label}
            </span>
            {badge.label && StatusIcon && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                aria-label={`Estado: ${badge.label}`}
              >
                <StatusIcon
                  className={`size-3 ${badgeIconAnimate}`}
                />
                {badge.label}
              </span>
            )}
          </div>
          <p className={getDescriptionStyles(status)}>
            {subStepMeta.description}
          </p>
        </div>

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

        {status === "processing" && (
          <span className="hidden md:flex shrink-0 items-center gap-2 text-xs text-amber-400/80">
            <Loader2 className="size-3 animate-spin" />
            <span>{processingMessage}</span>
            <span className="text-amber-400/60">{processingEta}</span>
          </span>
        )}

        {status === "completed" && (
          <span className="hidden md:inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-400">
            <CheckCircle className="size-4" />
            Hecho
          </span>
        )}


      </div>

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

      {status === "processing" && (
        <div className="mt-3 w-full md:hidden flex items-center gap-2 text-xs text-amber-400/80">
          <Loader2 className="size-3 animate-spin" />
          <span>{processingMessage}</span>
          <span className="text-amber-400/60">{processingEta}</span>
        </div>
      )}

      {status === "completed" && (
        <div className="mt-3 w-full md:hidden flex items-center gap-1 text-xs font-medium text-green-400">
          <CheckCircle className="size-4" />
          Hecho
        </div>
      )}
    </div>
  );
}
