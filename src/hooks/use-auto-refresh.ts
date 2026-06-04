"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ACTIVE_STATUSES = ["PENDING", "RUNNING"];

/**
 * Polls for updates when there are active ideas (generating, validating, etc.).
 * Uses a short interval (2.5s) for near-realtime updates.
 */
export function useAutoRefresh(
  hasActiveIdeas: boolean,
  intervalMs = 2500
) {
  const router = useRouter();

  useEffect(() => {
    if (!hasActiveIdeas) return;

    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [hasActiveIdeas, intervalMs, router]);
}
