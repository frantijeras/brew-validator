"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { useBridgeStatus } from "@/hooks/use-bridge-status";

/**
 * Sticky red banner that appears at the top of the dashboard when the
 * local bridge daemon is unreachable. Polling is owned by
 * `useBridgeStatus` in `src/hooks/use-bridge-status.ts` — keeping the
 * logic there means the same hook can guard action buttons elsewhere.
 *
 * Renders nothing while loading or when reachable. Includes a
 * "Reintentar" button that triggers an immediate refetch.
 */
export function BridgeStatusBanner() {
  const { status, loading, refresh } = useBridgeStatus();

  // Don't flash a red banner on the very first render — the status
  // fetch typically completes within a few hundred ms.
  if (loading) return null;
  if (!status || status.reachable) return null;

  const ageSeconds = status.ageSeconds;
  const lastSeenText =
    ageSeconds === null
      ? "sin registros recientes"
      : ageSeconds < 5
        ? "hace unos segundos"
        : `hace ${ageSeconds}s`;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-40 mb-4 rounded-lg border border-red-700 bg-red-900/30 text-red-200 shadow-sm"
    >
      <div className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-300 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-100">
            Servicio de IA no disponible
          </p>
          <p className="mt-0.5 text-xs text-red-200/80">
            El servidor de agentes está temporalmente fuera de línea
            {ageSeconds !== null ? ` (${lastSeenText})` : ""}. Tus ideas
            están guardadas y se procesarán cuando el servicio vuelva.
          </p>
        </div>
        <button
          onClick={() => {
            void refresh();
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-700/70 bg-red-950/40 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-950/70 hover:text-red-100 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          aria-label="Reintentar comprobación del bridge"
        >
          <RefreshCw className="size-3.5" />
          Reintentar
        </button>
      </div>
    </div>
  );
}

export default BridgeStatusBanner;
