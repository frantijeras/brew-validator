"use client";

import * as React from "react";

/**
 * SkeletonBase — bloque base reutilizable con efecto "shimmer"
 * (parpadeo) mediante `animate-pulse` de Tailwind.
 *
 * Se usa como ladrillo para construir esqueletos de carga más
 * complejos (PhaseCardSkeleton, SubStepSkeleton, …). Por defecto
 * renderiza un `div` redondeado con fondo `slate-700/50`.
 *
 * Accesibilidad: este componente es puramente decorativo, por lo
 * que se marca con `aria-hidden`. El contenedor padre (la tarjeta)
 * es quien debe exponer `role="status"` + `aria-busy` + texto
 * `sr-only` (solo-lectores-de-pantalla) describiendo la carga.
 */
export interface SkeletonBaseProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Clases Tailwind adicionales (alto, ancho, radio, etc.). */
  className?: string;
}

export function SkeletonBase({ className = "", ...rest }: SkeletonBaseProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-700/50 ${className}`}
      {...rest}
    />
  );
}
