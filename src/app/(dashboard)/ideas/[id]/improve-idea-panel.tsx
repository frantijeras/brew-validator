"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ImproveIdeaPanel — panel INLINE para mejorar la idea según el veredicto de la
 * validación, mediante un breve cuestionario generado por IA.
 *
 * Flujo:
 *  1. Al montarse, POST /improve/questions → {jobId}. Muestra "Generando
 *     preguntas…" y sondea el job (GET /api/jobs/[jobId]) hasta COMPLETED.
 *  2. El job devuelve output {questions:[{id,label,type,options?}]}. Renderiza
 *     un input por pregunta (text → textarea; choice → radios).
 *  3. Al enviar: POST /improve/apply {answers} → {jobId}. Esto deja la idea en
 *     status IMPROVING server-side: el panel avisa al padre (onApplied) para que
 *     refresque y muestre el spinner "Mejorando idea…".
 *
 * Un 403 en cualquiera de los dos POST dispara onLimit (el padre abre el
 * DemoLimitDialog tipo "refine").
 */

type QuestionType = "text" | "choice";

interface ImproveQuestion {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
}

interface ImproveIdeaPanelProps {
  ideaId: string;
  /** El apply tuvo éxito (idea en IMPROVING). El padre refresca la idea. */
  onApplied: () => void;
  onCancel: () => void;
  /** 403 en questions o apply → el padre abre el diálogo de límite. */
  onLimit: () => void;
}

type Phase = "loading" | "ready" | "error";

export function ImproveIdeaPanel({
  ideaId,
  onApplied,
  onCancel,
  onLimit,
}: ImproveIdeaPanelProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<ImproveQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Evita doble lanzamiento (StrictMode monta dos veces en desarrollo).
  const startedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Sondea el job de preguntas hasta que termine.
  const pollQuestionsJob = useCallback(
    (jobId: string) => {
      stopPolling();
      const tick = async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`, {
            credentials: "same-origin",
            cache: "no-store",
          });
          if (!res.ok) return; // reintenta en el siguiente tick
          const job = await res.json();
          if (job.status === "COMPLETED") {
            stopPolling();
            const parsed = parseQuestions(job.output);
            if (parsed.length === 0) {
              setPhase("error");
              setError(
                "La IA no devolvió preguntas. Inténtalo de nuevo en un momento."
              );
              return;
            }
            setQuestions(parsed);
            setPhase("ready");
          } else if (job.status === "FAILED") {
            stopPolling();
            setPhase("error");
            setError(
              job.error || "No se pudieron generar las preguntas. Reinténtalo."
            );
          }
        } catch {
          // Error transitorio de red: reintenta en el siguiente tick.
        }
      };
      void tick();
      pollRef.current = setInterval(tick, 2000);
    },
    [stopPolling]
  );

  // Lanza la generación de preguntas al montar.
  const startQuestions = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/improve/questions`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.status === 403) {
        onLimit();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudieron generar las preguntas");
      }
      const data = await res.json();
      if (!data?.jobId) throw new Error("Respuesta inesperada del servidor");
      pollQuestionsJob(data.jobId);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Error al generar preguntas");
    }
  }, [ideaId, onLimit, pollQuestionsJob]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startQuestions();
    return stopPolling;
  }, [startQuestions, stopPolling]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/improve/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ answers }),
      });
      if (res.status === 403) {
        onLimit();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo aplicar la mejora");
      }
      // El servidor deja la idea en IMPROVING; el padre refresca y muestra el
      // spinner. No sondeamos aquí.
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aplicar la mejora");
      setSubmitting(false);
    }
  }

  // Todas las preguntas deben tener respuesta no vacía para poder enviar.
  const canSubmit =
    questions.length > 0 &&
    questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  return (
    <div className="mb-8 rounded-xl border border-amber-500/30 bg-slate-900/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-4 text-amber-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Mejorar idea según el veredicto
        </h2>
      </div>

      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <span className="size-8 animate-spin rounded-full border-4 border-slate-700 border-t-amber-400" />
          <p className="text-sm font-medium text-slate-300">
            Generando preguntas…
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void startQuestions()}
            >
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {phase === "ready" && (
        <>
          <p className="mb-5 text-sm text-slate-400">
            Responde estas preguntas para reescribir la idea con lo aprendido en
            la validación. Al aplicar, se reiniciará la validación para que puedas
            volver a validarla.
          </p>

          <div className="space-y-5">
            {questions.map((q) => (
              <div key={q.id}>
                <label
                  htmlFor={`improve-q-${q.id}`}
                  className="mb-1.5 block text-sm font-medium text-white"
                >
                  {q.label}
                </label>
                {q.type === "choice" && q.options && q.options.length > 0 ? (
                  <div className="space-y-2">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 hover:border-slate-700"
                      >
                        <input
                          type="radio"
                          name={`improve-q-${q.id}`}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                          }
                          className="size-4 shrink-0 accent-amber-500"
                        />
                        <span className="text-sm text-slate-200">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    id={`improve-q-${q.id}`}
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    rows={3}
                    className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Tu respuesta"
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={submitting}
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              <Sparkles className="size-4" />
              {submitting ? "Aplicando…" : "Mejorar idea"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Helpers ── */

/**
 * Extrae el array de preguntas del output del job. El output puede llegar como
 * objeto o como string JSON; las preguntas viven en output.questions. Filtra y
 * normaliza para tolerar formatos parcialmente válidos.
 */
function parseQuestions(output: unknown): ImproveQuestion[] {
  let obj: unknown = output;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return [];
    }
  }
  if (!obj || typeof obj !== "object") return [];
  const raw = (obj as Record<string, unknown>).questions;
  if (!Array.isArray(raw)) return [];

  const result: ImproveQuestion[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const q = item as Record<string, unknown>;
    const label = typeof q.label === "string" ? q.label.trim() : "";
    if (!label) return;
    const id =
      typeof q.id === "string" && q.id.trim().length > 0
        ? q.id.trim()
        : `q${index}`;
    const type: QuestionType = q.type === "choice" ? "choice" : "text";
    let options: string[] | undefined;
    if (type === "choice" && Array.isArray(q.options)) {
      options = q.options
        .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
        .map((o) => o.trim());
    }
    result.push({ id, label, type, options });
  });
  return result;
}
