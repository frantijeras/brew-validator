"use client";

import * as React from "react";
import { SkeletonBase } from "./skeleton-base";

/**
 * SubStepSkeleton — esqueleto de carga para el área de un sub-paso
 * (naming/voice/visual de IDENTITY, o cualquier sub-step de fase)
 * mientras el agente genera su contenido en segundo plano.
 *
 * Reproduce la estructura de `SubStepCard`:
 *   número(circular) → icono → título + descripción   (fila del header)
 *
 * Accesibilidad: contenedor con `role="status"` + `aria-busy` + texto
 * `sr-only` (solo-lectores-de-pantalla). Los ladrillos internos son
 * decorativos.
 */
export interface SubStepSkeletonProps {
  /** Mensaje contextual para lectores de pantalla. */
  label?: string;
}

export function SubStepSkeleton({
  label = "Generando este sub-paso…",
}: SubStepSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 md:p-3 lg:p-4"
    >
      <span className="sr-only">{label}</span>

      <div className="flex items-center gap-3">
        {/* Número circular */}
        <SkeletonBase className="h-6 w-6 shrink-0 rounded-full" />
        {/* Icono del sub-paso */}
        <SkeletonBase className="size-4 shrink-0 rounded" />
        {/* Título + descripción */}
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBase className="h-3.5 w-2/5" />
          <SkeletonBase className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}
