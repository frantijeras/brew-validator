/**
 * Clasificación y tipos de errores del Bridge (Puente con las APIs de IA).
 *
 * FUENTE ÚNICA DE VERDAD. Tanto el callback de fases como el de ideas y la UI
 * (banner + tarjeta de fase + panel de historial) deben usar este módulo.
 *
 * El tipo de error ideal lo manda el propio bridge en el campo `errorType`
 * (ver `resolveErrorType`). Si el bridge no lo manda (versión antigua o error
 * inesperado), caemos a `classifyError(message)`, que adivina la categoría por
 * heurística de palabras clave — red de seguridad, no la vía principal.
 */

/** Categorías de error soportadas (enum estable compartido con el bridge daemon). */
export type ErrorCategory =
  | "timeout"
  | "rate_limit"
  | "insufficient_quota"
  | "api_key"
  | "model_not_found"
  | "server_error"
  | "empty_response"
  | "invalid_response"
  | "cancelled"
  | "unknown";

/** Conjunto de categorías válidas, para validar el `errorType` que llega del bridge. */
export const ERROR_CATEGORIES: readonly ErrorCategory[] = [
  "timeout",
  "rate_limit",
  "insufficient_quota",
  "api_key",
  "model_not_found",
  "server_error",
  "empty_response",
  "invalid_response",
  "cancelled",
  "unknown",
] as const;

export interface PhaseError {
  message: string;
  category: ErrorCategory;
  timestamp: string;
  agentName?: string;
  model?: string;
  /** Campos estructurados que el bridge rellena cuando puede (debugging). */
  errorType?: ErrorCategory;
  httpStatus?: number;
  retryCount?: number;
}

/** Metadatos legibles por categoría (etiqueta + descripción + pista de acción). */
export interface ErrorMeta {
  label: string;
  description: string;
  hint?: string;
}

/**
 * Mapa único de categoría → texto en español. La descripción explica QUÉ pasó;
 * la pista (`hint`) sugiere QUÉ hacer. Portado y unificado desde la copia que
 * vivía inline en el banner del bridge.
 */
export const errorMeta: Record<ErrorCategory, ErrorMeta> = {
  timeout: {
    label: "Tiempo de espera agotado",
    description: "El agente tardó más del límite permitido y fue cancelado.",
    hint: "Suele pasar con tareas largas (análisis con búsqueda web, informes extensos). Reintenta la fase o aumenta el timeout del job.",
  },
  rate_limit: {
    label: "Límite de API alcanzado",
    description: "El proveedor de IA rechazó la petición por exceso de llamadas (Rate limit).",
    hint: "Espera unos minutos y reintenta. Si persiste, reduce la frecuencia de jobs concurrentes.",
  },
  insufficient_quota: {
    label: "Sin créditos",
    description: "La cuenta del proveedor de IA no tiene saldo suficiente (tokens agotados).",
    hint: "Revisa la consola de tu proveedor (OpenCode, OpenAI, etc.) y recarga saldo o cambia de modelo.",
  },
  api_key: {
    label: "API key inválida",
    description: "El bridge no pudo autenticarse con el proveedor de IA.",
    hint: "Comprueba que las API keys del bridge están bien configuradas y tienen los scopes correctos.",
  },
  model_not_found: {
    label: "Modelo no disponible",
    description: "El modelo de IA configurado no existe o no es accesible.",
    hint: "Cambia el modelo en la configuración del agente (en /settings o en agent-models).",
  },
  server_error: {
    label: "Error del servidor de IA",
    description: "El proveedor de IA devolvió un error 5xx. Es un fallo del proveedor, no tuyo.",
    hint: "Reintenta en unos minutos. Si persiste, prueba con otro modelo o proveedor.",
  },
  empty_response: {
    label: "El modelo no respondió",
    description: "El agente terminó pero no devolvió contenido utilizable (respuesta vacía).",
    hint: "Reintenta la fase. Si persiste, el modelo puede estar saturado o el prompt de la skill necesita ajuste.",
  },
  invalid_response: {
    label: "Respuesta inválida",
    description: "El agente devolvió una respuesta que el bridge no pudo procesar (JSON roto).",
    hint: "Reintenta. Si persiste, el prompt de la skill puede estar generando respuestas inconsistentes.",
  },
  cancelled: {
    label: "Cancelado",
    description: "El job fue cancelado antes de terminar.",
  },
  unknown: {
    label: "Error del agente",
    description: "El agente falló por un motivo no identificado.",
  },
};

/** Etiquetas cortas por categoría (compat: derivadas de `errorMeta`). */
export const errorLabels = Object.fromEntries(
  ERROR_CATEGORIES.map((c) => [c, errorMeta[c].label]),
) as Record<ErrorCategory, string>;

/** Accesor seguro a la etiqueta: tolera categorías legacy / desconocidas. */
export function errorLabel(category: string | null | undefined): string {
  if (category && (ERROR_CATEGORIES as readonly string[]).includes(category)) {
    return errorMeta[category as ErrorCategory].label;
  }
  return errorMeta.unknown.label;
}

/** Accesor seguro a los metadatos completos (label + description + hint). */
export function getErrorMeta(category: string | null | undefined): ErrorMeta {
  if (category && (ERROR_CATEGORIES as readonly string[]).includes(category)) {
    return errorMeta[category as ErrorCategory];
  }
  return errorMeta.unknown;
}

/** ¿Es `value` una categoría de error válida? */
export function isErrorCategory(value: unknown): value is ErrorCategory {
  return typeof value === "string" && (ERROR_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Clasifica un mensaje de error crudo en una categoría (heurística por keywords).
 * Es el FALLBACK cuando el bridge no manda `errorType`. Orden importante: las
 * categorías más específicas se comprueban antes que las genéricas.
 */
export function classifyError(error: string | null | undefined): ErrorCategory {
  if (!error) return "unknown";
  const lower = error.toLowerCase();

  // Cancelado por el usuario
  if (lower.includes("cancel")) return "cancelled";

  // Timeout
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("deadline exceeded")
  ) {
    return "timeout";
  }

  // Sin créditos / saldo (antes que rate_limit y api_key: 402 es específico)
  if (
    lower.includes("insufficient_quota") ||
    lower.includes("quota exceeded") ||
    lower.includes("payment required") ||
    lower.includes("402") ||
    lower.includes("no credits") ||
    lower.includes("no credit") ||
    lower.includes("billing") ||
    lower.includes("out of credit")
  ) {
    return "insufficient_quota";
  }

  // Rate limit
  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("429") ||
    lower.includes("too many requests")
  ) {
    return "rate_limit";
  }

  // API key / auth
  if (
    lower.includes("invalid api key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("forbidden")
  ) {
    return "api_key";
  }

  // Modelo no encontrado
  if (
    lower.includes("model not found") ||
    lower.includes("model_not_found") ||
    lower.includes("model does not exist") ||
    lower.includes("model_does_not_exist") ||
    lower.includes("invalid model")
  ) {
    return "model_not_found";
  }

  // Respuesta vacía / el modelo no respondió
  if (
    lower.includes("empty response") ||
    lower.includes("empty_response") ||
    lower.includes("no output") ||
    lower.includes("no response") ||
    lower.includes("returned nothing") ||
    lower.includes("returned no output") ||
    lower.includes("respuesta vacía") ||
    lower.includes("sin respuesta")
  ) {
    return "empty_response";
  }

  // Error de servidor upstream (5xx)
  if (
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504") ||
    lower.includes("internal server error") ||
    lower.includes("bad gateway") ||
    lower.includes("service unavailable") ||
    lower.includes("upstream")
  ) {
    return "server_error";
  }

  // JSON inválido / respuesta mal formada
  if (
    lower.includes("json") ||
    lower.includes("parse") ||
    lower.includes("unexpected token") ||
    lower.includes("invalid response")
  ) {
    return "invalid_response";
  }

  return "unknown";
}

/** Payload (parcial) de un callback del bridge con campos de error estructurados. */
export interface BridgeErrorPayload {
  errorType?: unknown;
  error?: unknown;
  message?: unknown;
}

/**
 * Resuelve la categoría definitiva de un error. Prioriza el `errorType` que
 * manda el bridge (fuente fiable); si no es válido, cae a la heurística sobre
 * el mensaje crudo.
 */
export function resolveErrorType(payload: BridgeErrorPayload): ErrorCategory {
  if (isErrorCategory(payload.errorType)) return payload.errorType;
  const message =
    typeof payload.error === "string"
      ? payload.error
      : typeof payload.message === "string"
        ? payload.message
        : "";
  return classifyError(message);
}

/**
 * Formatea un timestamp ISO para mostrarlo en la UI (tiempo relativo o fecha).
 */
export function formatErrorTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Hace menos de 1 minuto";
  if (diffMin < 60) return `Hace ${diffMin} minuto${diffMin !== 1 ? "s" : ""}`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? "s" : ""}`;

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
