/**
 * Mensajes orientados al usuario (Capa 1 — UI Visual y Capa 3 — panel) para los
 * fallos del Bridge (Puente con las APIs de IA). FUENTE ÚNICA de los textos que
 * exige el spec: timeouts, créditos, rate limit (Límite de peticiones), respuesta
 * vacía, validación estructural y API externa de dominios.
 *
 * Estos textos están en lenguaje natural y siguen la regla lingüística: cada
 * sigla/tecnicismo lleva su significado en español entre paréntesis.
 *
 * Los toasts y el panel "Historial de Errores" deben tomar el texto de aquí,
 * mapeando por `ErrorCategory` (ver `phase-errors.ts`). No duplicar literales.
 */

import type { ErrorCategory } from "@/lib/phase-errors";

/** Severidad visual del toast/snackbar (Notificación emergente). */
export type Severity = "error" | "warning" | "info";

/** Color asociado a la severidad (rojo=crítico, amarillo=advertencia, azul=info). */
export const SEVERITY_COLOR: Record<Severity, string> = {
  error: "red",
  warning: "amber",
  info: "blue",
};

export interface UserFacingMessage {
  /** Severidad → color + icono en la UI. */
  severity: Severity;
  /** Texto exacto en lenguaje natural para el usuario. */
  text: string;
}

/**
 * Enlace de soporte para ampliar plan (placeholder configurable por entorno).
 * Si no hay var de entorno, cae a un mailto genérico. Nunca contiene secretos.
 */
export const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL || "mailto:soporte@copyfly.es";

/**
 * Mensaje exacto por categoría de error, según el spec. Cubre las 10 categorías
 * de `ErrorCategory`. Los textos marcados en el spec se reproducen literalmente.
 */
export const USER_MESSAGES: Record<ErrorCategory, UserFacingMessage> = {
  timeout: {
    severity: "warning",
    text: "El servicio tarda más de lo habitual. Intenta en 2 minutos o continúa con otras fases.",
  },
  insufficient_quota: {
    severity: "error",
    text: `Se han agotado los créditos disponibles. Contacta con soporte (${SUPPORT_URL}) para ampliar tu plan.`,
  },
  rate_limit: {
    severity: "warning",
    text: "En cola de espera (Rate limit — Límite de peticiones por minuto). Reintentaremos automáticamente en 60 segundos.",
  },
  empty_response: {
    severity: "warning",
    text: "El análisis está incompleto. Hemos cargado una versión simplificada. Puedes editarla manualmente.",
  },
  invalid_response: {
    severity: "warning",
    text: "La IA (Inteligencia Artificial) devolvió un formato inesperado. Lo hemos corregido automáticamente; revisa el resultado por si acaso.",
  },
  server_error: {
    severity: "error",
    text: "El proveedor de IA (Inteligencia Artificial) devolvió un error temporal (5xx). Reintenta en unos minutos o prueba con otro modelo.",
  },
  api_key: {
    severity: "error",
    text: "No pudimos autenticarnos con el proveedor de IA (Inteligencia Artificial). Revisa la configuración de claves de API (Interfaz de programación de aplicaciones).",
  },
  model_not_found: {
    severity: "error",
    text: "El modelo de IA (Inteligencia Artificial) configurado no está disponible. Cambia el modelo en Ajustes.",
  },
  cancelled: {
    severity: "info",
    text: "La fase se canceló antes de terminar. Puedes volver a lanzarla cuando quieras.",
  },
  unknown: {
    severity: "error",
    text: "Se produjo un error inesperado en el agente. Reintenta la fase; si persiste, contacta con soporte.",
  },
};

/** Texto de fallback (Plan de contingencia) cuando la API externa de dominios falla. */
export const DOMAIN_FALLBACK_MESSAGE: UserFacingMessage = {
  severity: "info",
  text: "No pudimos verificar disponibilidad de dominio. Procederemos sin validación externa.",
};

/** Devuelve el mensaje al usuario para una categoría, con fallback seguro. */
export function getUserMessage(category: ErrorCategory | string | null | undefined): UserFacingMessage {
  if (category && category in USER_MESSAGES) {
    return USER_MESSAGES[category as ErrorCategory];
  }
  return USER_MESSAGES.unknown;
}

/**
 * Mensaje de "posición en cola" para rate limit (Límite de peticiones). El
 * bridge puede informar cuántas solicitudes hay por delante.
 */
export function queuePositionMessage(position: number): UserFacingMessage {
  const safe = Number.isFinite(position) && position > 0 ? Math.floor(position) : 1;
  return {
    severity: "info",
    text: `En cola de espera. Tu turno: ${safe} posicion${safe === 1 ? "" : "es"}.`,
  };
}
