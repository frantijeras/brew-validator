/**
 * user-messages.ts — Mensajes de usuario centralizados (Capa de feedback).
 *
 * Fuente única de verdad para los textos que ve el usuario cuando algo falla
 * o cambia de estado en el flujo "Proyectos". Reutilizable por toasts,
 * banners y badges. Sin secretos, sin lógica de red.
 *
 * NOTA: Las siglas/tecnicismos llevan su significado en español la primera vez.
 */

/** Nivel de severidad de un mensaje de usuario. */
export type Severity = "error" | "warning" | "info";

/**
 * Color base por severidad (referencia semántica, NO clases Tailwind).
 * Los componentes mapean estos colores a sus propias clases concretas.
 */
export const SEVERITY_COLOR: Record<Severity, string> = {
  error: "red",
  warning: "amber",
  info: "blue",
};

/**
 * Categorías de mensaje conocidas. Se alinean con la taxonomía de errores
 * de fase (phase-errors.ts) más algunos estados generales de la UI.
 */
export type UserMessageCategory =
  | "rate_limit"
  | "timeout"
  | "api_key"
  | "model_not_found"
  | "server_error"
  | "empty_response"
  | "network"
  | "saved"
  | "queued"
  | "unknown";

export interface UserMessage {
  severity: Severity;
  /** Título corto opcional. */
  title?: string;
  /** Texto principal mostrado al usuario (español). */
  text: string;
}

/**
 * Catálogo de mensajes. La clave es la categoría; el valor el mensaje.
 * IA = Inteligencia Artificial. API = Interfaz de Programación de Aplicaciones.
 */
export const USER_MESSAGES: Record<UserMessageCategory, UserMessage> = {
  rate_limit: {
    severity: "warning",
    title: "Límite alcanzado",
    text: "Se alcanzó el límite de la API (Interfaz de Programación de Aplicaciones) de IA (Inteligencia Artificial). Espera unos segundos y vuelve a intentarlo.",
  },
  timeout: {
    severity: "warning",
    title: "Tiempo agotado",
    text: "La IA (Inteligencia Artificial) tardó demasiado en responder. Inténtalo de nuevo.",
  },
  api_key: {
    severity: "error",
    title: "Clave inválida",
    text: "La API key (clave de acceso a la API) configurada no es válida. Revisa los ajustes.",
  },
  model_not_found: {
    severity: "error",
    title: "Modelo no disponible",
    text: "El modelo de IA (Inteligencia Artificial) seleccionado no está disponible. Elige otro en los ajustes.",
  },
  server_error: {
    severity: "error",
    title: "Error del servidor",
    text: "El servidor de IA (Inteligencia Artificial) devolvió un error. Inténtalo de nuevo en unos minutos.",
  },
  empty_response: {
    severity: "warning",
    title: "Respuesta vacía",
    text: "La IA (Inteligencia Artificial) devolvió una respuesta vacía. Vuelve a lanzar la fase.",
  },
  network: {
    severity: "error",
    title: "Sin conexión",
    text: "No se pudo conectar con el servidor. Comprueba tu conexión a internet.",
  },
  saved: {
    severity: "info",
    title: "Guardado",
    text: "Los cambios se guardaron correctamente.",
  },
  queued: {
    severity: "info",
    title: "En cola",
    text: "La tarea se añadió a la cola de procesamiento.",
  },
  unknown: {
    severity: "error",
    title: "Error inesperado",
    text: "Ocurrió un error inesperado. Inténtalo de nuevo.",
  },
};

/** Mensaje de reserva cuando una categoría/dominio no tiene mensaje propio. */
export const DOMAIN_FALLBACK_MESSAGE: UserMessage = USER_MESSAGES.unknown;

/**
 * Devuelve el mensaje de usuario para una categoría dada.
 * Si la categoría no existe, devuelve el mensaje de reserva de dominio.
 */
export function getUserMessage(category: string): UserMessage {
  return (
    USER_MESSAGES[category as UserMessageCategory] ?? DOMAIN_FALLBACK_MESSAGE
  );
}

/**
 * Mensaje de posición en cola (informativo).
 * @param n Posición (1 = siguiente en procesarse).
 */
export function queuePositionMessage(n: number): UserMessage {
  const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  if (safe <= 1) {
    return {
      severity: "info",
      title: "En cola",
      text: "Tu tarea es la siguiente en procesarse.",
    };
  }
  return {
    severity: "info",
    title: "En cola",
    text: `Tu tarea está en la posición ${safe} de la cola.`,
  };
}
