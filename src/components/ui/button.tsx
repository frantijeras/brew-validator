"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

/**
 * Button — primitivo único del design system. Sustituye las decenas de botones
 * reimplementados inline con clases divergentes. Centraliza variantes, tamaños,
 * estado de carga, foco visible y disabled.
 *
 * Variantes:
 *  - primary:   acción principal (acento ámbar).
 *  - secondary: acción secundaria (outline oscuro).
 *  - danger:    acción destructiva (rojo).
 *  - ghost:     acción terciaria sin fondo.
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground font-semibold hover:bg-primary-hover active:bg-amber-600",
  secondary:
    "border border-line-strong bg-slate-800/60 text-slate-200 hover:bg-slate-700/60 hover:border-slate-600",
  danger: "bg-danger text-danger-foreground font-semibold hover:bg-danger-hover",
  ghost: "text-slate-300 hover:bg-slate-800 hover:text-white",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ocupa todo el ancho disponible. */
  fullWidth?: boolean;
  /** Muestra un spinner y deshabilita el botón. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      fullWidth,
      loading,
      disabled,
      className,
      children,
      type,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        disabled={disabled || loading}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        {...rest}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
