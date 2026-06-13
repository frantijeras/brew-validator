/**
 * Paleta de marca central (hex/RGB) para los generadores que NO pueden usar
 * clases Tailwind: la guía de estilo HTML (`identity-3d`), el render de reportes
 * (`report-renderer`) y el PDF (`pdf-export`, vía jsPDF que requiere RGB).
 *
 * Mantener alineada con los tokens semánticos de `tailwind.config.ts`
 * (primary/danger/surface/line) para que app y documentos generados sean
 * coherentes.
 */

/** Colores de marca en HEX (para HTML/CSS generado). */
export const BRAND_HEX = {
  primary: "#f59e0b", // = token `primary`
  primaryDark: "#b45309",
  neutralDark: "#0f172a", // = token `surface`
  neutralLight: "#f8fafc",
  text: "#1e293b",
  textMuted: "#64748b",
  border: "#e2e8f0",
  surface: "#ffffff",
} as const;

/** Colores en RGB (para jsPDF, que toma [r,g,b]). */
export const BRAND_RGB = {
  black: [0, 0, 0],
  dark: [50, 50, 50],
  grey: [100, 100, 100],
  light: [150, 150, 150],
  accent: [245, 158, 11], // = primary #f59e0b
  bg: [245, 245, 245],
} as const satisfies Record<string, [number, number, number]>;
