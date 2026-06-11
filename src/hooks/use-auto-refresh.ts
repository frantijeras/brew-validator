"use client";

import { useReactivePolling } from "./use-reactive-polling";

/**
 * Polls for updates when there are active ideas (generating, validating, etc.).
 * Uses a short interval for near-realtime updates and also refreshes instantly
 * when the tab regains focus (see useReactivePolling).
 */
export function useAutoRefresh(hasActiveIdeas: boolean, intervalMs = 2500) {
  useReactivePolling(hasActiveIdeas, intervalMs);
}
