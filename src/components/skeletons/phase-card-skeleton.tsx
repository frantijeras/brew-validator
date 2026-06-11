"use client";

import * as React from "react";
import { SkeletonBase } from "./skeleton-base";

/**
 * PhaseCardSkeleton — esqueleto de carga de una tarjeta de fase.
 *
 * Se muestra cuando una fase acaba de desbloquearse por un
 * Auto-Trigger (activación automática) en cascada y su contenido
 * (quiz, descripción, sub-pasos) aún se está "cocinando" en segundo
 * plano, de modo que todavía no hay datos reales que renderizar.
 *
 * Respeta el espaciado y la estructura visual de `PhaseCard`:
 *   número → icono → título   (fila del header)
 *   badge de estado            (línea indentada bajo el título)
 *   descripción                (2 líneas)
 *
 * Accesibilidad: el contenedor expone `role="status"` + `aria-busy`
 * y un texto `sr-only` (solo-lectores-de-pantalla). Los ladrillos
 * internos son decorativos (`aria-hidden`, heredado de SkeletonBase).
 */
export interface PhaseCardSkeletonProps {
  /** Mensaje contextual para lectores de pantalla. */
  label?: string;
}

export function PhaseCardSkeleton({
  label = "Preparando la siguiente fase…",
}: PhaseCardSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-amber-500/30 bg-amber-950/5 p-6 md:p-5 lg:p-6"
    >
      <span className="sr-only">{label}</span>

      {/* Header: número → icono → título */}
      <div className="flex flex-row items-center gap-2">
        <SkeletonBase className="h-10 w-10 shrink-0 rounded-lg md:h-6 md:w-6 md:rounded-md" />
        <SkeletonBase className="h-5 w-1/2 md:h-4" />
      </div>

      {/* Línea del badge de estado, indentada bajo el título */}
      <div className="mt-2 ml-2">
        <SkeletonBase className="h-4 w-32 rounded-full" />
      </div>

      {/* Descripción: 2 líneas */}
      <div className="mt-4 ml-2 space-y-2">
        <SkeletonBase className="h-3 w-full" />
        <SkeletonBase className="h-3 w-4/5" />
      </div>
    </div>
  );
}
