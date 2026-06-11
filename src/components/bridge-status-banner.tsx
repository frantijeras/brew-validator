"use client";

import { AlertCircle, WifiOff, X } from "lucide-react";
import { useBridgeStatus } from "@/hooks/use-bridge-status";
import { useState, useEffect } from "react";
import { classifyError, getErrorMeta, type ErrorMeta } from "@/lib/phase-errors";

/**
 * Banner that shows bridge status with real feedback:
 * - reachable + processing → no banner
 * - reachable + error → red with classified error category + raw detail
 * - not reachable → red "Bridge caído" (with lastError if any)
 *
 * The banner is dismissible with the X button. When dismissed, the banner
 * stays hidden for the rest of the session. Reloading the page re-evaluates
 * the bridge status.
 *
 * La clasificación del error vive en `@/lib/phase-errors` (fuente única,
 * compartida con los callbacks y el resto de la UI).
 */

/**
 * Deriva los metadatos legibles a partir del `lastError` crudo del bridge.
 * Usa la heurística unificada de `phase-errors`. Si no hay mensaje, muestra
 * un texto neutro de "sin detalle".
 */
function classifyBannerError(raw: string | null | undefined): ErrorMeta {
  if (!raw) {
    return {
      label: "Error sin detalle",
      description: "El agente falló sin devolver un mensaje concreto.",
    };
  }
  return getErrorMeta(classifyError(raw));
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

  const err = classifyBannerError(status.lastError);

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
