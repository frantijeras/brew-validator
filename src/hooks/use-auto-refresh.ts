"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useAutoRefresh(hasGenerating: boolean, intervalMs = 15000) {
  const router = useRouter();

  useEffect(() => {
    if (!hasGenerating) return;

    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [hasGenerating, intervalMs, router]);
}
