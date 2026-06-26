"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhaseActionButtonProps {
  projectId: string;
  phaseId: string;
  phaseType: string;
  label: string;
  /**
   * Si la fase falló DESPUÉS de responder el quiz, reintentamos SOLO el informe
   * (mode "report") reutilizando las respuestas ya persistidas, en vez de
   * regenerar el cuestionario desde cero (mode "questions").
   */
  retryReport?: boolean;
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
  retryReport = false,
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
        // - retryReport: NO regeneramos el quiz; relanzamos el informe
        //   reutilizando las respuestas persistidas (el backend las lee de la
        //   fase cuando no llegan en el body).
        // - IDENTITY: arranca SIEMPRE en modo "report" (genera el primer
        //   sub-paso "naming" directamente; NO tiene quiz). Lanzarla en
        //   "questions" generaba un cuestionario fantasma y el error
        //   "faltan respuestas".
        body: JSON.stringify(
          retryReport || phaseType === "IDENTITY"
            ? { projectId, phaseId, phaseType, mode: "report" }
            : { projectId, phaseId, phaseType }
        ),
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
      <Button
        type="button"
        variant="primary"
        fullWidth
        loading={running}
        onClick={handleClick}
        title={error ?? label}
      >
        {running ? (
          "Iniciando…"
        ) : (
          <>
            <Sparkles className="size-4" />
            {retryReport ? "Reintentar informe" : "Iniciar fase"}
          </>
        )}
      </Button>
      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="size-3" />
          {error}
        </span>
      )}
    </>
  );
}
