"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles, AlertCircle } from "lucide-react";

interface Question {
  id: string;
  label: string;
  type: string;
}

interface PhaseQuestionsModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  phaseId: string;
  phaseType: string;
  questions: Question[];
}

export function PhaseQuestionsModal({
  open,
  onClose,
  projectId,
  phaseId,
  phaseType,
  questions,
}: PhaseQuestionsModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Reset answers when modal opens
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      questions.forEach((q) => { initial[q.id] = ""; });
      setAnswers(initial);
      setError(null);
      setSubmitting(false);
      setPolling(false);
      setJobId(null);
    }
  }, [open, questions]);

  // Poll for report job completion
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error("not found");
        const data = await res.json();
        if (data.status === "COMPLETED") {
          clearInterval(interval);
          setPolling(false);
          setJobId(null);
          router.refresh();
        } else if (data.status === "FAILED") {
          clearInterval(interval);
          setPolling(false);
          setJobId(null);
          setError(data.error || "Error al generar el informe");
        }
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Filter out empty answers
    const filledAnswers: Record<string, string> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (v.trim()) filledAnswers[k] = v.trim();
    }

    if (Object.keys(filledAnswers).length === 0) {
      setError("Responde al menos una pregunta");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/projects/execute-phase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          phaseId,
          phaseType,
          mode: "report",
          answers: filledAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al enviar respuestas");
        setSubmitting(false);
      } else {
        setJobId(data.jobId);
        setPolling(true);
      }
    } catch {
      setError("Error de conexión");
      setSubmitting(false);
    }
  }

  function handleChange(qId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  if (!open) return null;

  const isLoading = submitting || polling;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-base font-semibold text-white">
            {polling ? "Generando informe..." : "Cuéntanos más"}
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        {polling ? (
          <div className="flex flex-col items-center gap-4 px-5 py-10">
            <span className="inline-block size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <p className="text-sm text-slate-400">
              Generando el informe con tus respuestas...
            </p>
            <p className="text-xs text-slate-500">Esto puede tomar un par de minutos</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Responde estas preguntas para ayudar a la IA a generar un análisis más preciso y adaptado a tu situación real.
            </p>

            {questions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium text-white mb-1.5">
                  {q.label}
                </label>
                <textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                  placeholder="Escribe tu respuesta..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>
            ))}

            {error && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="size-3" />
                {error}
              </span>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                <Sparkles className="size-4" />
                {isLoading ? "Enviando…" : "Generar informe"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
