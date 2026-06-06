"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles, AlertCircle } from "lucide-react";

/**
 * Question types supported by the modal:
 *  - "text": single-line free text. Rendered as a textarea (3 rows).
 *  - "textarea": longer free text. Rendered as a textarea (6 rows).
 *  - "choice": single-select radio buttons. The selected option's value is sent as a string.
 *  - "multi": multi-select checkboxes. Selected values are joined with a comma (",")
 *    and sent as a single string. The backend (and downstream agents) receive
 *    `Record<string, string>` regardless of the question type, so a deterministic
 *    delimiter is the cleanest way to keep the API contract stable.
 *
 * Options for "choice" / "multi" use the shape:
 *   { value: string, label: string }
 * The `value` is what gets sent; the `label` is what the user sees.
 */
interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  label: string;
  type: string;
  options?: QuestionOption[];
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
      questions.forEach((q) => {
        // For "multi" we store a comma-separated list of selected values.
        // For "choice" a single value. For text/textarea the user-typed string.
        initial[q.id] = "";
      });
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

    // Filter out empty answers. For "multi" we check the comma-joined string.
    const filledAnswers: Record<string, string> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (v && v.trim()) filledAnswers[k] = v.trim();
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

  function handleTextChange(qId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  function handleChoiceChange(qId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  function handleMultiToggle(qId: string, value: string) {
    setAnswers((prev) => {
      const current = prev[qId] || "";
      const list = current ? current.split(",").filter(Boolean) : [];
      const idx = list.indexOf(value);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(value);
      }
      return { ...prev, [qId]: list.join(",") };
    });
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

            {questions.map((q) => {
              // Normalize options: skills may emit raw strings or {value,label} objects.
              // Both shapes are accepted; strings are coerced into {value,label} at runtime
              // so the rendered radios/checkboxes always have valid data.
              const rawOpts: Array<string | QuestionOption> =
                (q.options as Array<string | QuestionOption> | undefined) || [];
              const opts: QuestionOption[] = rawOpts.map((o) =>
                typeof o === "string" ? { value: o, label: o } : o
              );
              return (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-white mb-1.5">
                    {q.label}
                  </label>

                  {/* text → 3 rows */}
                  {q.type === "text" && (
                    <textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      rows={3}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                  )}

                  {/* textarea → 6 rows */}
                  {q.type === "textarea" && (
                    <textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => handleTextChange(q.id, e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      rows={6}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                  )}

                  {/* choice → radio buttons */}
                  {q.type === "choice" && (
                    <div className="space-y-2">
                      {opts.map((opt) => {
                        const selected = (answers[q.id] || "") === opt.value;
                        return (
                          <label
                            key={opt.value}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                              selected
                                ? "border-amber-500 bg-amber-500/10 text-white"
                                : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600"
                            }`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={opt.value}
                              checked={selected}
                              onChange={() => handleChoiceChange(q.id, opt.value)}
                              className="size-4 cursor-pointer accent-amber-500"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* multi → checkboxes */}
                  {q.type === "multi" && (
                    <div className="space-y-2">
                      {opts.map((opt) => {
                        const current = answers[q.id] || "";
                        const selected = current
                          .split(",")
                          .filter(Boolean)
                          .includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                              selected
                                ? "border-amber-500 bg-amber-500/10 text-white"
                                : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => handleMultiToggle(q.id, opt.value)}
                              className="size-4 cursor-pointer accent-amber-500"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

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
