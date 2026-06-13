"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Card — superficie estándar del design system (antes el patrón
 * `rounded-xl border border-slate-800 bg-slate-950/60 p-5` duplicado por toda
 * la app). Centraliza superficie, borde, radio y padding.
 *
 * Variantes de superficie:
 *  - muted (por defecto): fondo slate-950/60 (paneles principales).
 *  - solid: fondo slate-900/40 (tarjetas internas).
 */
export type CardVariant = "muted" | "solid";
export type CardPadding = "sm" | "md" | "lg";

const surfaces: Record<CardVariant, string> = {
  muted: "border-line bg-slate-950/60",
  solid: "border-line bg-slate-900/40",
};

const paddings: Record<CardPadding, string> = {
  sm: "p-3.5",
  md: "p-4",
  lg: "p-5",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "muted", padding = "lg", className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border",
          surfaces[variant],
          paddings[padding],
          className
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";
