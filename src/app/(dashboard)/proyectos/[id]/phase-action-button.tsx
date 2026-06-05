"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

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
  const router = useRouter();

  async function handleClick() {
    setRunning(true);
    try {
      const res = await fetch("/api/projects/execute-phase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, phaseId, phaseType }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Error al ejecutar la fase");
      } else {
        router.refresh();
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={running}
      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {running ? (
        <>
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
          Generando…
        </>
      ) : (
        <>
          <Sparkles className="size-4" />
          Ejecutar
        </>
      )}
    </button>
  );
}
