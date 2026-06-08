/**
 * Phase error classification and types.
 *
 * When an agent fails (rate limit, timeout, invalid API key, etc.),
 * the webhook callback stores the error in `ProjectPhase.lastError`.
 * The UI then displays a human-readable error badge on the phase card.
 */

export interface PhaseError {
  message: string;
  category:
    | "rate_limit"
    | "timeout"
    | "api_key"
    | "model_not_found"
    | "server_error"
    | "unknown";
  timestamp: string;
  agentName?: string;
  model?: string;
}

/** Human-readable labels for each error category (Spanish). */
export const errorLabels: Record<PhaseError["category"], string> = {
  rate_limit: "Límite de API alcanzado",
  timeout: "Tiempo de espera agotado",
  api_key: "API key inválida",
  model_not_found: "Modelo no disponible",
  server_error: "Error del servidor de IA",
  unknown: "Error del agente",
};

/**
 * Classify an error message into a human-readable category.
 * Used by the webhook callback when an agent job fails.
 */
export function classifyError(error: string): PhaseError["category"] {
  if (!error) return "unknown";
  const lower = error.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many requests")) {
    return "rate_limit";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("deadline exceeded")) {
    return "timeout";
  }
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key") || lower.includes("authentication")) {
    return "api_key";
  }
  if (lower.includes("model not found") || lower.includes("invalid model") || lower.includes("model_does_not_exist")) {
    return "model_not_found";
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("internal server error") || lower.includes("bad gateway") || lower.includes("service unavailable")) {
    return "server_error";
  }
  return "unknown";
}

/**
 * Format a timestamp string for display in the UI.
 * Returns a human-readable relative time or formatted date.
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
