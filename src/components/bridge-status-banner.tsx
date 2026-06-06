"use client";

import { AlertCircle, WifiOff, X } from "lucide-react";
import { useBridgeStatus } from "@/hooks/use-bridge-status";
import { useState } from "react";

/**
 * Banner that shows bridge status with real feedback:
 * - reachable + processing → amber "Procesando..." (not an error)
 * - reachable + error → red with specific error message
 * - not reachable → red "Bridge caído"
 *
 * The banner is dismissible with the X button. When dismissed, the banner
 * stays hidden for the rest of the session. The user can manually re-check
 * the bridge status by reloading the page.
 */
export function BridgeStatusBanner() {
  const { status, loading } = useBridgeStatus();
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed) return null;
  if (!status) return null;

  // ── Bridge reachable and healthy ──
  if (status.reachable && status.state !== "error") {
    return null;
  }

  // ── Bridge reachable but last job had an error ──
  if (status.reachable && status.state === "error") {
    return (
      <div
        role="alert"
        className="sticky top-0 z-40 mb-4 rounded-lg border border-red-700/60 bg-red-900/25 text-red-200"
      >
        <div className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-400 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-100">
              Error en el último agente
            </p>
            <p className="mt-0.5 text-xs text-red-200/80">
              {status.lastError || "Error desconocido en el procesamiento."}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-red-200/80 transition-colors hover:bg-red-950/40 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            aria-label="Cerrar aviso"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
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

  // If we have a lastError, show it instead of the generic message
  const errorDetail = status.lastError || null;

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
            {errorDetail ? (
              <>
                <span className="font-medium text-red-100">Último error:</span>{" "}
                {errorDetail}
              </>
            ) : (
              <>
                El servidor de agentes está fuera de línea
                {ageSeconds !== null ? ` (${lastSeenText})` : ""}. Tus ideas
                están guardadas y se procesarán cuando el servicio vuelva.
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
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
