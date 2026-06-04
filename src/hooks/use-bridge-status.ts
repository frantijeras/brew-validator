"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface BridgeStatus {
  reachable: boolean;
  reason?: string;
  lastHeartbeatAt: string | null;
  ageSeconds: number | null;
  uptimeSeconds: number | null;
  lastJobAt: string | null;
  staleAfterSeconds: number;
}

const POLL_INTERVAL_MS = 15_000; // 15s

/**
 * useBridgeStatus — polls /api/bridge/status and exposes the result.
 *
 * Used by action buttons (Validar, Pulir, Generar) to short-circuit
 * when the bridge is unreachable, showing a clear error to the user
 * instead of letting the job sit PENDING forever.
 */
export function useBridgeStatus() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/bridge/status", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Status fetch failed");
      const data: BridgeStatus = await res.json();
      if (mountedRef.current) setStatus(data);
    } catch {
      if (mountedRef.current) {
        setStatus({
          reachable: false,
          reason: "network-error",
          lastHeartbeatAt: null,
          ageSeconds: null,
          uptimeSeconds: null,
          lastJobAt: null,
          staleAfterSeconds: 60,
        });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchStatus]);

  return { status, loading, refresh: fetchStatus };
}
