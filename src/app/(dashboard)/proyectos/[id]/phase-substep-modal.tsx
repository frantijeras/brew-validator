"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Eye,
  Code2,
} from "lucide-react";
import { renderMarkdown } from "@/components/markdown-renderer";

/**
 * SubStep artifact shape (mirrors what the agent emits and the bridge stores
 * in `ProjectPhase.subStepArtifact`):
 *   { type?: "html" | "markdown", content?: string, options?: [{value,label}] }
 *
 * `type` and `content` are loosely typed because they come from a JSON
 * column in Prisma. The modal falls back to sensible defaults when they
 * are missing (markdown / empty).
 */
export interface SubStepArtifact {
  type?: "html" | "markdown";
  content?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface PhaseSubstepModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  phaseId: string;
  phaseType: string;
  subStep: string;
  subStepArtifact: SubStepArtifact | null;
  subStepChoice: string | null;
  // After choose/iterate, the parent refetches the phase list. We refresh() to
  // pick up the new status (PROCESSING).
  onResolved?: () => void;
}

/**
 * Sub-step kinds that expose a free-text "custom" input. Other kinds
 * (compare/simulate/pilars) only allow choosing from options.
 */
const FREE_INPUT_SUBSTEPS = new Set(["naming", "mockup", "final"]);

/**
 * Modal que muestra el artefacto intermedio de un sub-paso (mockup HTML,
 * comparativa en markdown, etc.) y permite:
 *  - Elegir entre opciones pre-generadas (A/B/C) → POST /substep/choose
 *  - Escribir valor libre (para naming) → POST /substep/choose
 *  - Iterar con feedback libre → POST /substep/iterate
 *  - Cancelar y cerrar
 *
 * Tras confirmar, el modal cierra y la fase pasa a PROCESSING. El padre
 * hace router.refresh() para mostrar la nueva pill "Procesando".
 */
export function PhaseSubstepModal({
  open,
  onClose,
  projectId,
  phaseId,
  phaseType,
  subStep,
  subStepArtifact,
  subStepChoice,
  onResolved,
}: PhaseSubstepModalProps) {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<string | null>(
    subStepChoice || null
  );
  const [customValue, setCustomValue] = useState<string>("");
  const [showIterate, setShowIterate] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"rendered" | "source">(
    "rendered"
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset state when the modal opens or the artifact changes
  useEffect(() => {
    if (open) {
      setSelectedOption(subStepChoice || null);
      setCustomValue("");
      setShowIterate(false);
      setFeedback("");
      setError(null);
      setSubmitting(false);
      setPreviewMode("rendered");
    }
  }, [open, subStepChoice, subStepArtifact?.content]);

  // Auto-resize the iframe to fit its content
  useEffect(() => {
    if (
      previewMode === "rendered" &&
      subStepArtifact?.type === "html" &&
      iframeRef.current
    ) {
      const iframe = iframeRef.current;
      const resize = () => {
        try {
          const body = iframe.contentDocument?.body;
          if (body) {
            iframe.style.height = `${body.scrollHeight + 16}px`;
          }
        } catch {
          // Ignore cross-origin errors
        }
      };
      iframe.addEventListener("load", resize);
      // Also try a tick later
      const t = setTimeout(resize, 200);
      return () => {
        iframe.removeEventListener("load", resize);
        clearTimeout(t);
      };
    }
  }, [previewMode, subStepArtifact?.type, subStepArtifact?.content]);

  const isFreeInput = FREE_INPUT_SUBSTEPS.has(subStep);
  const options = subStepArtifact?.options ?? [];
  const artifactType: "html" | "markdown" = subStepArtifact?.type || "markdown";
  const artifactContent = subStepArtifact?.content || "";

  // Determine the next sub-step after the user confirms. "final" is the only
  // terminal value. The agent decides downstream what comes next — we just
  // pass "final" and the bridge handles the rest (the agent emits the
  // appropriate `subStep` in its output).
  const nextSubStepValue = "final";

  async function handleChoose() {
    if (!selectedOption && !customValue.trim()) {
      setError("Selecciona una opción o escribe un valor");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const choice = customValue.trim() || selectedOption || "";
      const res = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/substep/choose`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            choice,
            nextSubStep: nextSubStepValue,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al confirmar la elección");
        setSubmitting(false);
        return;
      }
      // If the sub-step is "naming" of a branding phase, also rename the
      // project + idea to the chosen name so subsequent phases see the new
      // name in their context. Best-effort — if it fails, we don't block the
      // flow.
      if (phaseType === "IDENTITY" && subStep === "naming" && choice) {
        try {
          await fetch(`/api/projects/${projectId}/rename`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newName: choice, phaseId }),
          });
        } catch {
          // Non-blocking: the project keeps its old name until the user
          // re-renames manually.
        }
      }
      onResolved?.();
      onClose();
      router.refresh();
    } catch {
      setError("Error de conexión");
      setSubmitting(false);
    }
  }

  async function handleIterate() {
    if (!feedback.trim()) {
      setError("Escribe el feedback para iterar");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/substep/iterate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: feedback.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iterar");
        setSubmitting(false);
        return;
      }
      onResolved?.();
      onClose();
      router.refresh();
    } catch {
      setError("Error de conexión");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const subStepTitle: Record<string, string> = {
    naming: "Elige un nombre",
    mockup: "Elige un estilo visual",
    compare: "Elige una opción técnica",
    simulate: "Elige un escenario",
    pilars: "Revisa los pilares",
    final: "Confirma el resultado",
  };
  const title =
    subStepTitle[subStep] || `Revisa el sub-paso: ${subStep}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="size-4 text-amber-400" />
            {title}
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content: scrollable area with the artifact + choices */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Artifact preview */}
          {subStepArtifact ? (
            <div>
              {/* Toolbar: switch between rendered preview and source */}
              {artifactType === "html" && (
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setPreviewMode("rendered")}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 transition-colors ${
                      previewMode === "rendered"
                        ? "border-amber-500 bg-amber-500/10 text-amber-300"
                        : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <Eye className="size-3" />
                    Vista previa
                  </button>
                  <button
                    onClick={() => setPreviewMode("source")}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 transition-colors ${
                      previewMode === "source"
                        ? "border-amber-500 bg-amber-500/10 text-amber-300"
                        : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <Code2 className="size-3" />
                    HTML
                  </button>
                </div>
              )}

              {artifactType === "html" && previewMode === "rendered" && (
                <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
                  <iframe
                    ref={iframeRef}
                    srcDoc={artifactContent}
                    title="Sub-step preview"
                    className="w-full min-h-[320px] border-0"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}

              {artifactType === "html" && previewMode === "source" && (
                <pre className="overflow-auto max-h-96 rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
                  <code>{artifactContent}</code>
                </pre>
              )}

              {artifactType === "markdown" && (
                <div
                  className="markdown-body rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(artifactContent),
                  }}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No hay artefacto disponible para este sub-paso.
            </p>
          )}

          {/* Options A/B/C */}
          {options.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-white">
                Elige una opción
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {options.map((opt) => {
                  const selected = selectedOption === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSelectedOption(opt.value);
                        setCustomValue("");
                      }}
                      disabled={submitting}
                      className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors disabled:opacity-50 ${
                        selected
                          ? "border-amber-500 bg-amber-500/10 text-white"
                          : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {selected ? (
                          <CheckCircle2 className="size-4 text-amber-400" />
                        ) : (
                          <span className="inline-block size-4 rounded-full border border-slate-600" />
                        )}
                        <span className="font-medium">{opt.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Free input for naming/mockup */}
          {isFreeInput && (
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">
                O escribe tu propio valor
              </label>
              <input
                type="text"
                value={customValue}
                onChange={(e) => {
                  setCustomValue(e.target.value);
                  if (e.target.value) setSelectedOption(null);
                }}
                placeholder={
                  subStep === "naming"
                    ? "Ej: Tallow & Glow"
                    : subStep === "mockup"
                      ? "Describe tu propio estilo..."
                      : "Escribe tu propuesta..."
                }
                disabled={submitting}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}

          {/* Iterate panel */}
          {showIterate && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-2">
              <label className="block text-sm font-medium text-white">
                Feedback para regenerar
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Ej: Me gusta A pero con la paleta de C y tipografía más bold"
                rows={4}
                disabled={submitting}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleIterate}
                  disabled={submitting || !feedback.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Iterando…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4" />
                      Regenerar
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowIterate(false);
                    setFeedback("");
                    setError(null);
                  }}
                  disabled={submitting}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancelar iteración
                </button>
              </div>
            </div>
          )}

          {error && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle className="size-3" />
              {error}
            </span>
          )}
        </div>

        {/* Footer actions */}
        {!showIterate && (
          <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-end gap-2">
            <button
              onClick={() => setShowIterate(true)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
            >
              <RefreshCw className="size-4" />
              Iterar
            </button>
            <button
              onClick={handleChoose}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              <CheckCircle2 className="size-4" />
              {submitting ? "Enviando…" : "Confirmar elección"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
