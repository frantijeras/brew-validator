/**
 * Política de reintentos del Bridge (Puente con las APIs de IA) y constantes de
 * acción de resolución.
 *
 * NOTA DE ARQUITECTURA: el reintento real (volver a llamar al modelo) lo ejecuta
 * el bridge daemon en el VPS (Servidor privado virtual). Este módulo es la FUENTE
 * ÚNICA que define la política (cuántos intentos, cuánto esperar) para que la app
 * Next.js y el daemon compartan los mismos números, y para que los callbacks
 * registren un `resolutionAction` consistente en `BridgeLog`.
 */

import type { ErrorCategory } from "@/lib/phase-errors";

/** Nº máximo de reintentos automáticos antes de rendirse (spec: hasta 3). */
export const MAX_RETRIES = 3;

/** Backoff exponencial: espera base en milisegundos (spec: progresiva). */
export const BACKOFF_BASE_MS = 2000;

/** Espera específica para rate limit (Límite de peticiones): 60s (spec). */
export const RATE_LIMIT_RETRY_MS = 60000;

/** Timeout máximo de un job antes de considerarlo `timeout` (spec: 30s). */
export const JOB_TIMEOUT_MS = 30000;

/**
 * Calcula la espera (ms) antes del reintento `attempt` (1-based) con backoff
 * exponencial: base * 2^(attempt-1). Para rate_limit se usa la espera fija.
 */
export function backoffDelayMs(attempt: number, category?: ErrorCategory): number {
  if (category === "rate_limit") return RATE_LIMIT_RETRY_MS;
  const n = Math.max(1, Math.floor(attempt));
  return BACKOFF_BASE_MS * 2 ** (n - 1);
}

/**
 * ¿Esta categoría de error es reintentable automáticamente? Errores de
 * configuración (api_key, model_not_found) o de saldo (insufficient_quota) NO
 * se reintentan: reintentar no los arregla. Cancelado tampoco.
 */
export function isRetryable(category: ErrorCategory): boolean {
  switch (category) {
    case "timeout":
    case "rate_limit":
    case "server_error":
    case "empty_response":
    case "invalid_response":
      return true;
    case "insufficient_quota":
    case "api_key":
    case "model_not_found":
    case "cancelled":
    case "unknown":
      return false;
  }
}

/** ¿El error es crítico? (agotó reintentos → dispara alerta capa 4). */
export function isCritical(retryCount: number | null | undefined): boolean {
  return typeof retryCount === "number" && retryCount >= MAX_RETRIES;
}

/**
 * Acciones de resolución estables para el campo `resolutionAction` de BridgeLog.
 * Permiten reportar en el panel "Historial de Errores" QUÉ hizo el sistema.
 */
export const RESOLUTION_ACTION = {
  /** Reintento automático con backoff. */
  RETRY: "retry",
  /** Reintento con prompt simplificado (respuesta vacía). */
  SIMPLIFIED_RETRY: "simplified_retry",
  /** Corrección automática de JSON (regex/heurística). */
  AUTOCORRECTED: "autocorrected",
  /** Se cargó una versión de contingencia (fallback). */
  FALLBACK: "fallback",
  /** Fase devuelta a AVAILABLE para reintento manual del usuario. */
  RESET_TO_AVAILABLE: "reset_to_available",
  /** Se encoló por rate limit (Límite de peticiones). */
  QUEUED: "queued",
  /** Se disparó alerta crítica (capa 4). */
  ALERTED: "alerted",
  /** Solo registrado, sin acción. */
  LOGGED: "logged",
} as const;

export type ResolutionAction =
  (typeof RESOLUTION_ACTION)[keyof typeof RESOLUTION_ACTION];
