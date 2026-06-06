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

/**
 * Botón principal (estilo "primary") para lanzar una fase AVAILABLE.
 * Devuelve un fragment con el <button> + un eventual <span> de error,
 * sin wrapper propio: el padre controla el layout (wrapper 50% desktop /
 * grid 2-cols móvil, alineado a la derecha).
 *
 * Mantiene la API: projectId, phaseId, phaseType, label.
 */
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

  return (
    <>
      <button
        onClick={handleClick}
        disabled={running}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title={error ?? label}
      >
        {running ? (
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
    </>
  );
}
