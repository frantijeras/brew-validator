"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Server-state polling for RSC pages.
 *
 * While `active` is true, calls `router.refresh()` on an interval AND
 * immediately whenever the tab regains focus or becomes visible again.
 *
 * The focus/visibility trigger is the important bit: the main "the process
 * finished but the UI still says 'processing' until I reload" symptom happens
 * when the user switches away from the tab (timers are throttled/paused) and a
 * background job completes meanwhile. Refreshing on return makes the UI catch
 * up instantly instead of waiting for the next tick.
 */
export function useReactivePolling(active: boolean, intervalMs = 3000) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    // Guard against firing router.refresh() after the component unmounts (e.g.
    // the user navigates away between a queued tick and cleanup).
    let mounted = true;
    const refresh = () => {
      if (mounted) router.refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const interval = setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, intervalMs, router]);
}
