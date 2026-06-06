"use client";

import { AlertCircle, WifiOff, X } from "lucide-react";
import { useBridgeStatus } from "@/hooks/use-bridge-status";
import { useState, useEffect } from "react";

/**
 * Banner that shows bridge status with real feedback:
 * - reachable + processing → no banner
 * - reachable + error → red with classified error category + raw detail
 * - not reachable → red "Bridge caído" (with lastError if any)
 *
 * The banner is dismissible with the X button. When dismissed, the banner
 * stays hidden for the rest of the session. Reloading the page re-evaluates
 * the bridge status.
 */

type ErrorCategory = {
  label: string;
  description: string;
  hint?: string;
};

/**
 * Parsea el `lastError` y devuelve una categoría legible. La heurística
 * mira palabras clave en el mensaje crudo del bridge. Si no encaja con
 * ninguna, devuelve "Error desconocido" con el mensaje tal cual.
 */
function classifyError(raw: string | null | undefined): ErrorCategory {
  const text = (raw ?? "").toLowerCase();

  if (!text) {
    return {
      label: "Error sin detalle",
      description: "El agente falló sin devolver un mensaje concreto.",
    };
  }

  // Timeout
  if (text.includes("timeout") || text.includes("timed out")) {
    return {
      label: "Timeout",
      description: "El agente tardó más del límite permitido y fue cancelado.",
      hint: "Suele pasar con tareas largas (análisis con búsqueda web, generación de informes extensos). Puedes reintentar la fase o aumentar el timeout del job.",
    };
  }

  // Rate limit
  if (
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("429") ||
    text.includes("too many requests")
  ) {
    return {
      label: "Rate limit",
      description: "El proveedor de IA rechazó la petición por exceso de llamadas.",
      hint: "Espera unos minutos y reintenta. Si persiste, reduce la frecuencia de jobs concurrentes.",
    };
  }

  // Sin tokens / créditos
  if (
    text.includes("insufficient_quota") ||
    text.includes("quota exceeded") ||
    text.includes("credit") ||
    text.includes("billing") ||
    text.includes("payment required") ||
    text.includes("402") ||
    text.includes("no credits")
  ) {
    return {
      label: "Sin créditos",
      description: "La cuenta del proveedor de IA no tiene saldo suficiente.",
      hint: "Revisa la consola de tu proveedor (OpenRouter, OpenAI, etc.) y recarga saldo o cambia de modelo.",
    };
  }

  // API key inválida
  if (
    text.includes("invalid api key") ||
    text.includes("unauthorized") ||
    text.includes("401") ||
    text.includes("403") ||
    text.includes("forbidden")
  ) {
    return {
      label: "API key inválida",
      description: "El bridge no pudo autenticarse con el proveedor de IA.",
      hint: "Comprueba que las API keys del bridge están bien configuradas y tienen los scopes correctos.",
    };
  }

  // Modelo no disponible
  if (
    text.includes("model not found") ||
    text.includes("model_not_found") ||
    text.includes("model does not exist") ||
    text.includes("invalid model")
  ) {
    return {
      label: "Modelo no disponible",
      description: "El modelo de IA configurado no existe o no es accesible.",
      hint: "Cambia el modelo en la configuración del agente (en /settings o en agent-models).",
    };
  }

  // Error de servidor upstream
  if (
    text.includes("500") ||
    text.includes("502") ||
    text.includes("503") ||
    text.includes("504") ||
    text.includes("internal server error") ||
    text.includes("bad gateway") ||
    text.includes("service unavailable") ||
    text.includes("upstream")
  ) {
    return {
      label: "Error del servidor",
      description: "El proveedor de IA devolvió un error 5xx. Es un fallo del proveedor, no tuyo.",
      hint: "Reintenta en unos minutos. Si persiste, prueba con otro modelo o proveedor.",
    };
  }

  // JSON inválido / respuesta mal formada
  if (
    text.includes("json") ||
    text.includes("parse") ||
    text.includes("unexpected token") ||
    text.includes("invalid response")
  ) {
    return {
      label: "Respuesta inválida",
      description: "El agente devolvió una respuesta que el bridge no pudo procesar.",
      hint: "Reintenta. Si persiste, el prompt de la skill puede estar generando respuestas inconsistentes.",
    };
  }

  // Cancelado por el usuario
  if (text.includes("cancel")) {
    return {
      label: "Cancelado",
      description: "El job fue cancelado antes de terminar.",
    };
  }

  // Genérico
  return {
    label: "Error del agente",
    description: raw ?? "Error desconocido.",
  };
}

export function BridgeStatusBanner() {
  const { status, loading } = useBridgeStatus();
  const [dismissed, setDismissed] = useState(false);

  // Persistencia del dismiss: si el usuario cierra el banner, se guarda un
  // identificador del error en localStorage con un timestamp. Si el mismo
  // error sigue activo 30 minutos después, se vuelve a mostrar (el
  // usuario probablemente olvidó y necesita ver el aviso de nuevo).
  // Si el error cambia (mensaje diferente), se resetea el flag.
  useEffect(() => {
    if (!status || (status.reachable && status.state !== "error")) return;
    const errorKey = status.lastError || "bridge-offline";
    const raw = typeof window !== "undefined" ? localStorage.getItem("bridge-banner-dismissed") : null;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { key: string; at: number };
      const sameError = parsed.key === errorKey;
      const ttl = 30 * 60 * 1000; // 30 minutos
      if (sameError && Date.now() - parsed.at < ttl) {
        setDismissed(true);
      } else {
        // error cambió o expiró el TTL → resetea
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, [status]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined" && status) {
      const errorKey = status.lastError || "bridge-offline";
      localStorage.setItem(
        "bridge-banner-dismissed",
        JSON.stringify({ key: errorKey, at: Date.now() })
      );
    }
  };

  if (loading || dismissed) return null;
  if (!status) return null;

  // ── Bridge reachable and healthy ──
  if (status.reachable && status.state !== "error") {
    return null;
  }

  const err = classifyError(status.lastError);

  // ── Bridge reachable but last job had an error ──
  if (status.reachable && status.state === "error") {
    return (
      <ErrorBanner
        title={`Error en el último agente — ${err.label}`}
        description={err.description}
        hint={err.hint}
        raw={status.lastError}
        onDismiss={handleDismiss}
      />
    );
  }

  // ── Bridge not reachable ──
  const ageSeconds = status.ageSeconds;
  const lastSeenText =
    ageSeconds === null
      ? "sin registros recientes"
      : ageSeconds < 5
        ? "hace unos segundos"
        : `hace ${ageSeconds}s`;

  // Si tenemos lastError (ej: el último intento antes de quedarse offline),
  // lo mostramos clasificado. Si no, mensaje genérico de bridge caído.
  if (status.lastError) {
    return (
      <ErrorBanner
        title={`Servicio de IA no disponible — ${err.label}`}
        description={err.description}
        hint={err.hint}
        raw={status.lastError}
        onDismiss={handleDismiss}
      />
    );
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-40 mb-4 rounded-lg border border-red-700 bg-red-900/30 text-red-200 shadow-sm"
    >
      <div className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4">
        <WifiOff className="mt-0.5 size-5 shrink-0 text-red-300 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-100">
            Servicio de IA no disponible
          </p>
          <p className="mt-0.5 text-xs text-red-200/80">
            El servidor de agentes está fuera de línea
            {ageSeconds !== null ? ` (${lastSeenText})` : ""}. Tus ideas
            están guardadas y se procesarán cuando el servicio vuelva.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-red-200/80 transition-colors hover:bg-red-950/40 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          aria-label="Cerrar aviso"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ErrorBanner({
  title,
  description,
  hint,
  raw,
  onDismiss,
}: {
  title: string;
  description: string;
  hint?: string;
  raw?: string | null;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="sticky top-0 z-40 mb-4 rounded-lg border border-red-700/60 bg-red-900/25 text-red-200"
    >
      <div className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-400 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-100">{title}</p>
          <p className="mt-0.5 text-xs text-red-200/80">{description}</p>
          {hint && (
            <p className="mt-1 text-xs text-red-200/70 italic">{hint}</p>
          )}
          {raw && raw !== description && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-red-300/60 hover:text-red-200">
                Detalle técnico
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-red-950/40 px-2 py-1.5 text-[10px] text-red-200/80">
                {raw}
              </pre>
            </details>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-red-200/80 transition-colors hover:bg-red-950/40 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          aria-label="Cerrar aviso"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default BridgeStatusBanner;
