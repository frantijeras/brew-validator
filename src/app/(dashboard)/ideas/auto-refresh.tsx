"use client";

import { useAutoRefresh } from "@/hooks/use-auto-refresh";

export function IdeasAutoRefresh({ hasGenerating }: { hasGenerating: boolean }) {
  useAutoRefresh(hasGenerating);
  return null;
}
