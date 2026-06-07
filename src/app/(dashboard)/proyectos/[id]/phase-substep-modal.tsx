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
  ArrowRight,
  Loader2,
  Pencil,
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
  // Current project name. Needed for the rename-impact preview shown
  // when confirming a name in the IDENTITY `naming` sub-step.
  currentName?: string;
  // After choose/iterate, the parent refetches the phase list. We refresh() to
  // pick up the new status (PROCESSING).
  onResolved?: () => void;
}

/**
 * Sub-step kinds that expose a free-text "custom" input. Other kinds
 * (voice/compare/simulate/pilars) only allow choosing from options.
 */
const FREE_INPUT_SUBSTEPS = new Set(["naming", "visual", "mockup", "final"]);

// Shape of the response from /api/projects/[id]/rename/preview
interface RenamePreviewResponse {
  currentName: string;
  newName: string;
  occurrencesByLocation: Array<{ kind: string; id: string; count: number; title: string }>;
  totalReplacements: number;
  totalDocuments: number;
  error?: string;
}

// Shape of the response from /api/projects/[id]/rename
interface RenameResponse {
  success: boolean;
  newName: string;
  ideaId: string;
  projectId: string;
  stats: {
    ideaTitleChanged: boolean;
    projectNameChanged: boolean;
    artifactsUpdated: number;
    versionsUpdated: number;
    reportsUpdated: number;
    totalReplacements: number;
    occurrencesByLocation: Array<{ kind: string; id: string; count: number; title: string }>;
  };
  error?: string;
}

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
 *
 * Special case — IDENTITY `naming` sub-step: when the user confirms a
 * name, the modal intercepts the flow and:
 *   1) Calls /rename/preview to estimate how many artifact mentions
 *      will be rewritten.
 *   2) Shows a small confirmation dialog with the impact (e.g. "12
 *      menciones en 3 documentos").
 *   3) If the user confirms → calls /substep/choose (advances the
 *      sub-step) AND /rename (propagates the name). A success banner
 *      with the actual stats is shown.
 *   4) If the user cancels → close the preview dialog and stay on the
 *      main modal; the sub-step is NOT advanced.
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
  currentName,
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

  // ── Rename preview / success state (IDENTITY naming only) ──
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [renamePreview, setRenamePreview] =
    useState<RenamePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState<{
    newName: string;
    totalReplacements: number;
    totalDocuments: number;
  } | null>(null);

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
      setPendingName(null);
      setRenamePreview(null);
      setPreviewLoading(false);
      // NOTE: we do NOT reset successBanner here — it lives outside the
      // modal lifecycle (rendered as a fixed banner) and should only
      // clear itself on its own timer or on a new rename.
    }
  }, [open, subStepChoice, subStepArtifact?.content]);

  // Auto-dismiss the success banner after a few seconds
  useEffect(() => {
    if (!successBanner) return;
    const t = setTimeout(() => setSuccessBanner(null), 6000);
    return () => clearTimeout(t);
  }, [successBanner]);

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

  /**
   * IDENTITY `naming` interception: fetch the rename-impact preview
   * before committing. On success, open the small confirm dialog. On
   * failure, fall through to a direct /rename call so the user is not
   * blocked by a preview outage.
   */
  async function fetchRenamePreview(choice: string) {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/rename/preview?newName=${encodeURIComponent(choice)}`,
        { method: "GET" }
      );
      const data: RenamePreviewResponse = await res.json();
      if (!res.ok) {
        // Don't block the user — fall through to direct rename.
        console.warn(
          "[rename/preview] failed, falling through to direct rename:",
          data.error
        );
        await performRename(choice, { suppressErrors: true });
        return;
      }
      setPendingName(choice);
      setRenamePreview(data);
    } catch (err) {
      console.warn("[rename/preview] network error, falling through:", err);
      await performRename(choice, { suppressErrors: true });
    } finally {
      setPreviewLoading(false);
    }
  }

  /**
   * Performs the actual /substep/choose (advance) + /rename (propagate)
   * for the IDENTITY naming sub-step. Used both when the user confirms
   * the preview dialog AND when preview itself errored out.
   */
  async function performRename(
    choice: string,
    options: { suppressErrors?: boolean } = {}
  ) {
    setSubmitting(true);
    setError(null);
    try {
      // 1) Advance the sub-step
      const chooseRes = await fetch(
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
      const chooseData = await chooseRes.json();
      if (!chooseRes.ok) {
        setError(chooseData.error || "Error al confirmar la elección");
        setSubmitting(false);
        return;
      }
      // 2) Apply the rename + propagation
      const renameRes = await fetch(`/api/projects/${projectId}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: choice, phaseId }),
      });
      const renameData: RenameResponse = await renameRes.json();
      if (!renameRes.ok) {
        if (!options.suppressErrors) {
          setError(renameData.error || "Error al renombrar el proyecto");
        }
        // Still consider the choose step done — show the success banner
        // with zeros so the user gets visual feedback.
      }
      setSuccessBanner({
        newName: choice,
        totalReplacements: renameData.stats?.totalReplacements ?? 0,
        totalDocuments: renameData.stats?.occurrencesByLocation?.length ?? 0,
      });
      onResolved?.();
      onClose();
      router.refresh();
    } catch (err) {
      if (!options.suppressErrors) {
        setError(err instanceof Error ? err.message : "Error de conexión");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChoose() {
    if (!selectedOption && !customValue.trim()) {
      setError("Selecciona una opción o escribe un valor");
      return;
    }
    const choice = customValue.trim() || selectedOption || "";

    // ── IDENTITY naming: intercept with preview ──
    if (phaseType === "IDENTITY" && subStep === "naming" && choice) {
      // If we have a currentName and the new name is actually different,
      // show the impact preview. If they're identical, skip the dialog
      // and go straight to the choose + rename.
      if (currentName && currentName.trim() !== "" && currentName.trim() !== choice) {
        await fetchRenamePreview(choice);
        return;
      }
      // No current name (project not initialized) or same name: skip
      // the preview dialog and go directly.
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/phases/${phaseId}/substep/choose`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ choice, nextSubStep: nextSubStepValue }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Error al confirmar la elección");
          setSubmitting(false);
          return;
        }
        // Best-effort rename — fire and forget
        try {
          const renameRes = await fetch(`/api/projects/${projectId}/rename`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newName: choice, phaseId }),
          });
          const renameData: RenameResponse = await renameRes.json();
          setSuccessBanner({
            newName: choice,
            totalReplacements: renameData.stats?.totalReplacements ?? 0,
            totalDocuments:
              renameData.stats?.occurrencesByLocation?.length ?? 0,
          });
        } catch {
          /* non-blocking */
        }
        onResolved?.();
        onClose();
        router.refresh();
      } catch {
        setError("Error de conexión");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── Default flow: non-naming sub-step or non-IDENTITY phase ──
    setSubmitting(true);
    setError(null);
    try {
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
      onResolved?.();
      onClose();
      router.refresh();
    } catch {
      setError("Error de conexión");
      setSubmitting(false);
    }
  }

  /**
   * Confirms the rename preview dialog. Closes the preview, runs the
   * actual choose + rename.
   */
  async function handleConfirmRenamePreview() {
    if (!pendingName) return;
    const name = pendingName;
    setRenamePreview(null);
    setPendingName(null);
    await performRename(name);
  }

  /**
   * Cancels the rename preview dialog. The main modal stays open, the
   * sub-step is NOT advanced, and the user can pick a different name
   * or a different option.
   */
  function handleCancelRenamePreview() {
    setRenamePreview(null);
    setPendingName(null);
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

  if (!open && !successBanner) return null;

  const subStepTitle: Record<string, string> = {
    naming: "Elige un nombre",
    voice: "Revisa el tono de voz",
    visual: "Elige un estilo visual",
    mockup: "Elige un estilo visual",
    compare: "Elige una opción técnica",
    simulate: "Elige un escenario",
    pilars: "Revisa los pilares",
    final: "Confirma el resultado",
  };
  const title =
    subStepTitle[subStep] || `Revisa el sub-paso: ${subStep}`;

  return (
    <>
      {/* Success banner — lives outside the main modal so it survives
          the rename → close transition. Auto-dismisses after 6s. */}
      {successBanner && (
        <div
          className="fixed top-4 right-4 z-[60] w-full max-w-md rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400 shrink-0">
              <CheckCircle2 className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                Proyecto renombrado a{" "}
                <strong className="text-emerald-300">
                  {successBanner.newName}
                </strong>
                {successBanner.totalReplacements > 0 ? (
                  <>
                    . {successBanner.totalReplacements}{" "}
                    {successBanner.totalReplacements === 1
                      ? "mención actualizada"
                      : "menciones actualizadas"}{" "}
                    en {successBanner.totalDocuments}{" "}
                    {successBanner.totalDocuments === 1
                      ? "documento"
                      : "documentos"}
                    .
                  </>
                ) : (
                  "."
                )}
              </p>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="rounded-md p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Cerrar aviso"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {open && (
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
                        : subStep === "visual" || subStep === "mockup"
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
                  disabled={submitting || previewLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                >
                  <RefreshCw className="size-4" />
                  Iterar
                </button>
                <button
                  onClick={handleChoose}
                  disabled={submitting || previewLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                >
                  {submitting || previewLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {previewLoading ? "Calculando impacto…" : "Enviando…"}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Confirmar elección
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rename-impact preview dialog (IDENTITY naming only) */}
      {renamePreview && pendingName && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Pencil className="size-4 text-amber-400" />
                Confirmar renombrado
              </h3>
              <button
                onClick={handleCancelRenamePreview}
                disabled={submitting}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Vas a renombrar a{" "}
                <strong className="text-amber-300">{pendingName}</strong>.
              </p>

              {renamePreview.totalReplacements > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-amber-200">
                    Se actualizarán{" "}
                    <strong>{renamePreview.totalReplacements}</strong>{" "}
                    {renamePreview.totalReplacements === 1
                      ? "mención"
                      : "menciones"}{" "}
                    en{" "}
                    <strong>{renamePreview.totalDocuments}</strong>{" "}
                    {renamePreview.totalDocuments === 1
                      ? "documento"
                      : "documentos"}.
                  </p>
                  {renamePreview.occurrencesByLocation.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-300 max-h-40 overflow-y-auto">
                      {renamePreview.occurrencesByLocation.map((loc) => (
                        <li
                          key={`${loc.kind}-${loc.id}`}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-slate-400">
                            {loc.title}
                          </span>
                          <span className="text-slate-500 tabular-nums shrink-0">
                            {loc.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No hay documentos previos que contengan el nombre
                  actual, así que solo se actualizará el nombre del
                  proyecto.
                </p>
              )}

              <p className="text-xs text-slate-500">
                Esto incluye el nombre en informes de validación,
                análisis de mercado y demás artefactos generados.
              </p>

              {error && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="size-3" />
                  {error}
                </span>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleConfirmRenamePreview}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Aplicando…
                    </>
                  ) : (
                    <>
                      <ArrowRight className="size-4" />
                      Confirmar renombrado
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelRenamePreview}
                  disabled={submitting}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
