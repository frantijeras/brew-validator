"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Input / Textarea — primitivos del design system para campos de formulario.
 * Centralizan las clases que antes se duplicaban como `inputClass` en varias
 * pantallas. Usan `focus-visible:ring` (solo teclado) en vez de `focus:ring`
 * (que mostraba el anillo también al hacer clic).
 *
 * Look: fondo slate-800, borde slate-700, rounded-lg, texto sm.
 */
const fieldClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white " +
  "placeholder:text-slate-500 focus:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-amber-500 focus-visible:border-amber-500";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...rest }, ref) => {
    return <input ref={ref} className={cn(fieldClass, className)} {...rest} />;
  }
);
Input.displayName = "Input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...rest }, ref) => {
    return <textarea ref={ref} className={cn(fieldClass, className)} {...rest} />;
  }
);
Textarea.displayName = "Textarea";
