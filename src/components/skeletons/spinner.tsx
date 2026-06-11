"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

/**
 * Spinner — indicador de carga inline reutilizable.
 *
 * Envuelve el icono `Loader2` de lucide-react con la animación
 * `animate-spin` de Tailwind y, opcionalmente, un texto contextual
 * al lado (ej. "Generando preguntas…").
 *
 * El repo usaba hasta ahora `Loader2 animate-spin` suelto en cada
 * componente; este Spinner unifica ese patrón con accesibilidad
 * integrada (role="status" + aria-busy + texto sr-only
 * solo-lectores-de-pantalla).
 *
 * Diseño: sin librerías nuevas, solo Tailwind + lucide-react ya
 * presentes en el repo.
 */
export interface SpinnerProps {
  /** Texto visible junto al spinner. Si se omite, solo se muestra el icono. */
  label?: string;
  /**
   * Texto para lectores de pantalla cuando NO hay `label` visible.
   * Por defecto "Cargando…". Si se pasa `label`, este se ignora porque
   * el propio `label` ya describe la acción.
   */
  srLabel?: string;
  /** Clases Tailwind para el tamaño del icono. Por defecto `size-4`. */
  iconClassName?: string;
  /** Clases Tailwind para el contenedor (color del texto, gap, etc.). */
  className?: string;
}

export function Spinner({
  label,
  srLabel = "Cargando…",
  iconClassName = "size-4",
  className = "",
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-busy="true"
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      <Loader2 className={`shrink-0 animate-spin ${iconClassName}`} aria-hidden="true" />
      {label ? (
        <span>{label}</span>
      ) : (
        <span className="sr-only">{srLabel}</span>
      )}
    </span>
  );
}
