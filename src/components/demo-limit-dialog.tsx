"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export type LimitRequestType =
  | "ideas"
  | "projects"
  | "phase_undo"
  | "skills"
  | "handoff";

interface DemoLimitDialogProps {
  open: boolean;
  onClose: () => void;
  type: LimitRequestType;
  title?: string;
  message?: string;
}

const DEFAULT_TITLES: Record<LimitRequestType, string> = {
  ideas: "Has alcanzado el límite de ideas",
  projects: "Has alcanzado el límite de proyectos",
  phase_undo: "Has agotado los reintentos de fase",
  skills: "Acceso a Skills no disponible",
  handoff: "Acceso a Hand-off no disponible",
};

const DEFAULT_MESSAGES: Record<LimitRequestType, string> = {
  ideas: "Has alcanzado el máximo de ideas de tu plan.",
  projects: "Has alcanzado el máximo de proyectos de tu plan.",
  phase_undo: "Has alcanzado el máximo de veces que puedes deshacer una fase.",
  skills: "La sección de Skills no está incluida en tu plan.",
  handoff: "La sección de Hand-off no está incluida en tu plan.",
};

/**
 * DemoLimitDialog — diálogo que aparece cuando un usuario en modo demo topa con
 * un límite de su plan. Le explica la situación y le permite ENVIAR una
 * solicitud al administrador para que amplíe sus límites (POST /api/limit-requests).
 *
 * Solo se muestra a usuarios NO admin: los gates que lo abren ya están detrás de
 * comprobaciones server-side que excluyen a los administradores.
 */
export function DemoLimitDialog({
  open,
  onClose,
  type,
  title,
  message,
}: DemoLimitDialogProps) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    // Reset transient state on close so reopening starts fresh.
    setSent(false);
    setError(null);
    setPending(false);
    onClose();
  }

  async function handleRequest() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/limit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo enviar la solicitud.");
      }
      // Una solicitud ya pendiente se considera éxito (el backend deduplica).
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar la solicitud."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title ?? DEFAULT_TITLES[type]}
      footer={
        sent ? (
          <Button type="button" variant="primary" onClick={handleClose}>
            Entendido
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={pending}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={pending}
              onClick={handleRequest}
            >
              Solicitar ampliar mis límites
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <p className="text-sm text-emerald-300">
          ✅ Solicitud enviada al administrador. Te avisará cuando la revise.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            Estás en el modo demo de BrewIdea.
          </p>
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
            {message ?? DEFAULT_MESSAGES[type]}
          </p>
          <p className="text-sm text-slate-400">
            Si necesitas más, pide al administrador que amplíe los límites de tu
            cuenta. Revisará tu solicitud y te avisará.
          </p>
          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
