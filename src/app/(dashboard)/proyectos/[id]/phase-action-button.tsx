"use client";

import { useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();



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
        // Refresh page immediately so the parent shows PROCESSING state + cancel button
        router.refresh();
      }
    } catch {
      setError("Error de conexión");
      setRunning(false);
    }
  }

  // Determine button state
  const isLoading = running;

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
            Iniciando…
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
