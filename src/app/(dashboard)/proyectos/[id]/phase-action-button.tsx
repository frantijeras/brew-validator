"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertCircle } from "lucide-react";

interface PhaseActionButtonProps {
  projectId: string;
  phaseId: string;
  phaseType: string;
  label: string;
}

export function PhaseActionButton({
  projectId,
  phaseId,
  phaseType,
  label,
}: PhaseActionButtonProps) {
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // Poll for job completion
  useEffect(() => {
    if (!jobId) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("Job not found");

        const data = await res.json();
        if (data.status === "COMPLETED") {
          clearInterval(pollRef.current!);
          setPolling(false);
          setRunning(false);
          setJobId(null);
          router.refresh();
        } else if (data.status === "FAILED") {
          clearInterval(pollRef.current!);
          setPolling(false);
          setRunning(false);
          setJobId(null);
          setError(data.error || "Error al procesar la fase");
        }
      } catch {
        // keep polling
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, router]);

  async function handleClick() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/execute-phase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, phaseId, phaseType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al ejecutar la fase");
        setRunning(false);
      } else {
        setJobId(data.jobId);
        setPolling(true);
      }
    } catch {
      setError("Error de conexión");
      setRunning(false);
    }
  }

  // Determine button state
  const isLoading = running || polling;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
            {polling ? "Procesando…" : "Iniciando…"}
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Ejecutar
          </>
        )}
      </button>
      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="size-3" />
          {error}
        </span>
      )}
    </div>
  );
}
