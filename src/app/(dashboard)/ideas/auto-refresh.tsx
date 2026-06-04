"use client";

import { useAutoRefresh } from "@/hooks/use-auto-refresh";

interface Props {
  /** Whether any idea has status === "GENERATING" */
  hasGenerating?: boolean;
  /** Whether any idea has validationStatus === "RUNNING" */
  hasValidating?: boolean;
  /** Whether any job has status PENDING or RUNNING for this page's ideas */
  hasActiveJobs?: boolean;
}

export function IdeasAutoRefresh({ hasGenerating, hasValidating, hasActiveJobs }: Props) {
  const hasActiveIdeas = Boolean(hasGenerating || hasValidating || hasActiveJobs);
  useAutoRefresh(hasActiveIdeas);
  return null;
}
