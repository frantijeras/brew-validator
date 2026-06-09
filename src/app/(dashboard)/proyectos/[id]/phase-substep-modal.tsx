"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  Download,
  Type,
  Palette as PaletteIcon,
  BookOpen,
  Printer,
  Hash,
} from "lucide-react";
import { renderMarkdown } from "@/components/markdown-renderer";
import {
  parseVisualArtifactContent,
  getVisualOption,
  type VisualStyleGuide,
} from "@/lib/identity-visual";
import {
  buildBrandBook,
  brandBookToMarkdown,
  type BrandBook,
  type BrandBookSection,
} from "@/lib/identity-brandbook";
import { getNextIdentitySubStep } from "@/lib/identity-substeps";

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
  // ── Brand Book (final sub-step) data ──
  /** Raw content from the naming sub-step artifact (used by brandbook). */
  namingArtifactContent?: string | null;
  /** Raw content from the voice sub-step artifact (used by brandbook). */
  voiceArtifactContent?: string | null;
  /** Raw JSON from the visual sub-step artifact (used by brandbook). */
  visualArtifactJson?: string | null;
  /** The variant the user chose in the visual sub-step ("A", "B" or "C"). */
  visualChoice?: string | null;
  /** Project description for the brandbook intro. */
  projectDescription?: string | null;
}

/**
 * Sub-step kinds that expose a free-text "custom" input. Other kinds
 * (voice/compare/simulate/pilars) only allow choosing from options.
 *
 * The `visual` sub-step used to be in this set (it had a free-text
 * "describe tu propio estilo" field), but in Phase 3 it is now
 * option-only (A/B/C). Custom styling is requested via the iterate
 * feedback box instead.
 */
const FREE_INPUT_SUBSTEPS = new Set(["naming", "mockup", "final"]);

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
  namingArtifactContent,
  voiceArtifactContent,
  visualArtifactJson,
  visualChoice,
  projectDescription,
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

  // ── Visual sub-step state (IDENTITY visual only) ──
  // The `visual` sub-step has its own rendering: 3 tabs (A/B/C), one
  // iframe, a meta card with palette/typography/mood, and three
  // actions (use this style / iterate / download HTML).
  const [visualVariant, setVisualVariant] = useState<"A" | "B" | "C">("A");
  const visualContent = useMemo(
    () => parseVisualArtifactContent(subStepArtifact?.content),
    [subStepArtifact?.content]
  );
  const isVisualSubStep = useMemo(
    () => phaseType === "IDENTITY" && subStep === "visual",
    [phaseType, subStep]
  );
  const currentVisualOption: VisualStyleGuide | null = useMemo(() => {
    if (!isVisualSubStep) return null;
    return getVisualOption(visualContent, visualVariant);
  }, [isVisualSubStep, visualContent, visualVariant]);

  // ── Brand Book sub-step state (IDENTITY final only) ──
  // The `final` sub-step shows a consolidated Brand Book generated
  // from the naming, voice and visual outputs. We compute it once.
  const isBrandBook = useMemo(
    () => phaseType === "IDENTITY" && subStep === "final",
    [phaseType, subStep]
  );
  const brandBook: BrandBook | null = useMemo(() => {
    if (!isBrandBook) return null;
    try {
      return buildBrandBook({
        projectName: currentName || "Proyecto sin nombre",
        namingContent: namingArtifactContent ?? null,
        voiceContent: voiceArtifactContent ?? null,
        visualChoice: visualChoice ?? null,
        visualArtifactJson: visualArtifactJson ?? null,
        projectContext: { description: projectDescription },
      });
    } catch {
      return null;
    }
  }, [
    isBrandBook,
    currentName,
    namingArtifactContent,
    voiceArtifactContent,
    visualChoice,
    visualArtifactJson,
    projectDescription,
  ]);
  const [brandBookActiveSection, setBrandBookActiveSection] =
    useState<string>("intro");

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
      // Sync the visual variant tab to the stored choice (or "A" by
      // default). Keeps the modal consistent when reopening.
      if (
        phaseType === "IDENTITY" &&
        subStep === "visual" &&
        subStepChoice &&
        (subStepChoice === "A" ||
          subStepChoice === "B" ||
          subStepChoice === "C")
      ) {
        setVisualVariant(subStepChoice);
      } else {
        setVisualVariant("A");
      }
      // NOTE: we do NOT reset successBanner here — it lives outside the
      // modal lifecycle (rendered as a fixed banner) and should only
      // clear itself on its own timer or on a new rename.
      setBrandBookActiveSection("intro");
    }
  }, [open, subStepChoice, subStepArtifact?.content, phaseType, subStep]);

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

  /**
   * Determine the next sub-step after the user confirms.
   * For IDENTITY phases, we use the canonical sub-step order (naming → voice →
   * visual → final → null). For all other phases, "final" is the terminal value.
   */
  const nextSubStepValue =
    phaseType === "IDENTITY" ? getNextIdentitySubStep(subStep) : "final";

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

      // If no replacements needed, skip the confirmation dialog entirely
      if (data.totalReplacements === 0) {
        setRenamePreview(null);
        setPendingName(null);
        await performRename(choice);
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
      // 1) First do RENAME — the endpoint verifies we're still in "naming" sub-step
      const renameRes = await fetch(`/api/projects/${projectId}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: choice, phaseId }),
      });
      const renameData: RenameResponse = await renameRes.json();

      // If rename fails, STOP here — do NOT advance the sub-step (rollback natural)
      if (!renameRes.ok) {
        if (!options.suppressErrors) {
          setError(renameData.error || "Error al renombrar el proyecto");
          setSubmitting(false);
          return;
        }
        // Even with suppressErrors, if the error is about not being in "naming" or "final"
        // we should still block the sub-step advance
        setSubmitting(false);
        return;
      }

      // 2) Rename succeeded — now advance the sub-step
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
        // Even if the sub-step advance fails, the rename was already applied.
        // Show partial success.
        console.warn("Rename succeeded but sub-step advance failed:", chooseData.error);
      }

      setSuccessBanner({
        newName: choice,
        totalReplacements: renameData.stats?.totalReplacements ?? 0,
        totalDocuments: renameData.stats?.occurrencesByLocation?.length ?? 0,
      });
      onResolved?.();
      onClose();
      window.dispatchEvent(new CustomEvent("project-changed"));
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
    const selectedOpt = selectedOption
      ? options.find((o) => o.value === selectedOption)
      : null;
    const choice =
      customValue.trim() || selectedOpt?.label || selectedOption || "";

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
        // 1) First apply the rename
        const renameRes = await fetch(`/api/projects/${projectId}/rename`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newName: choice, phaseId }),
        });
        const renameData: RenameResponse = await renameRes.json();
        if (!renameRes.ok) {
          setError(renameData.error || "Error al renombrar el proyecto");
          setSubmitting(false);
          return;
        }
        // 2) Rename succeeded — now advance the sub-step
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
          console.warn("Rename succeeded but sub-step advance failed:", data.error);
        }
        setSuccessBanner({
          newName: choice,
          totalReplacements: renameData.stats?.totalReplacements ?? 0,
          totalDocuments:
            renameData.stats?.occurrencesByLocation?.length ?? 0,
        });
        onResolved?.();
        onClose();
        window.dispatchEvent(new CustomEvent("project-changed"));
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
      window.dispatchEvent(new CustomEvent("project-changed"));
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
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch {
      setError("Error de conexión");
      setSubmitting(false);
    }
  }

  /**
   * Opens the Brand Book view in a new tab.
   */
  function handleBrandBookView() {
    const url = `/api/projects/${projectId}/phases/${phaseId}/brandbook/view`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /**
   * Downloads the Brand Book as a PDF.
   */
  function handleBrandBookDownload() {
    const url = `/api/projects/${projectId}/phases/${phaseId}/brandbook/download`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Triggers a native browser download of the current visual variant.
   * The endpoint serves the HTML with `Content-Disposition: attachment`
   * so the browser saves it as `style-guide-{A|B|C}.html`.
   */
  function handleDownloadVisual() {
    if (!isVisualSubStep) return;
    const url = `/api/projects/${projectId}/phases/${phaseId}/substep/visual-download?variant=${visualVariant}`;
    // Use a hidden link so the iframe is not disturbed.
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * "Usar este estilo" — visual sub-step flow.
   * Calls /substep/choose with the current variant (A/B/C) and advances
   * to the "final" sub-step. After confirming, the user lands on the
   * brand-book step.
   */
  async function handleVisualChoose() {
    if (!isVisualSubStep) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/substep/choose`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            choice: visualVariant,
            nextSubStep: "final",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al confirmar el estilo");
        setSubmitting(false);
        return;
      }
      onResolved?.();
      onClose();
      window.dispatchEvent(new CustomEvent("project-changed"));
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
              {isBrandBook ? (
                brandBook ? (
                  <BrandBookFinalPreview
                    brandBook={brandBook}
                    activeSection={brandBookActiveSection}
                    onSectionChange={setBrandBookActiveSection}
                    projectId={projectId}
                    phaseId={phaseId}
                    currentName={currentName || "Proyecto sin nombre"}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="size-8 animate-spin text-amber-400" />
                    <p className="text-sm text-slate-400">
                      Generando Brand Book…
                    </p>
                    <button
                      onClick={() => {
                        // Force a memo recalc by closing and reopening
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600"
                    >
                      <RefreshCw className="size-4" />
                      Regenerar
                    </button>
                  </div>
                )
              ) : subStepArtifact ? (
                isVisualSubStep && visualContent ? (
                  <VisualSubStepPreview
                    options={visualContent.options}
                    current={visualVariant}
                    onChange={setVisualVariant}
                    iframeRef={iframeRef}
                    previewMode={previewMode}
                    onPreviewModeChange={setPreviewMode}
                    projectId={projectId}
                    phaseId={phaseId}
                  />
                ) : (
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
                )
              ) : (
                <p className="text-sm text-slate-400">
                  No hay artefacto disponible para este sub-paso.
                </p>
              )}

              {/* Options A/B/C — hidden for the visual sub-step, which has its
                  own tab-based switcher inside the artifact preview. */}
              {options.length > 0 && !isVisualSubStep && (
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

              {/* Free input for naming/mockup (visual sub-step is option-only) */}
              {isFreeInput && !isVisualSubStep && (
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
                {isBrandBook ? (
                  <>
                    <button
                      onClick={() => handleBrandBookView()}
                      disabled={submitting || !brandBook}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                    >
                      <Eye className="size-4" />
                      Ver
                    </button>
                    <button
                      onClick={() => handleBrandBookDownload()}
                      disabled={submitting || !brandBook}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                    >
                      <Download className="size-4" />
                      Descargar PDF
                    </button>
                  </>
                ) : isVisualSubStep ? (
                  <>
                    <button
                      onClick={handleDownloadVisual}
                      disabled={submitting || !currentVisualOption}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                    >
                      <Download className="size-4" />
                      Descargar HTML
                    </button>
                    <button
                      onClick={() => setShowIterate(true)}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                    >
                      <RefreshCw className="size-4" />
                      Iterar
                    </button>
                    <button
                      onClick={handleVisualChoose}
                      disabled={submitting || !currentVisualOption}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Enviando…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" />
                          Usar este estilo
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                  <p className="text-sm font-medium text-amber-200">
                    Se modificarán{" "}
                    <strong>{renamePreview.totalReplacements}</strong>{" "}
                    {renamePreview.totalReplacements === 1
                      ? "referencia"
                      : "referencias"}{" "}
                    en{" "}
                    <strong>{renamePreview.totalDocuments}</strong>{" "}
                    {renamePreview.totalDocuments === 1
                      ? "documento"
                      : "documentos"}.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No hay referencias que modificar.
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

/* ------------------------------------------------------------------ */
/* VisualSubStepPreview                                                */
/* ------------------------------------------------------------------ */

interface VisualSubStepPreviewProps {
  options: [VisualStyleGuide, VisualStyleGuide, VisualStyleGuide];
  current: "A" | "B" | "C";
  onChange: (v: "A" | "B" | "C") => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  previewMode: "rendered" | "source";
  onPreviewModeChange: (m: "rendered" | "source") => void;
  projectId: string;
  phaseId: string;
}

/**
 * Dedicated renderer for the IDENTITY `visual` sub-step:
 *   - Tabs A / B / C to switch between the 3 style-guide variants
 *   - Toolbar: Vista previa / HTML
 *   - Iframe (rendered) or <pre> (source) for the selected variant
 *   - Meta card with palette swatches, fonts and mood tag
 *
 * Kept as a separate component for readability; receives only the
 * data it needs and calls back via `onChange` for the active tab.
 */
function VisualSubStepPreview({
  options,
  current,
  onChange,
  iframeRef,
  previewMode,
  onPreviewModeChange,
}: VisualSubStepPreviewProps) {
  const currentOption =
    options.find((o) => o.variant === current) || options[0];
  const tabs: Array<"A" | "B" | "C"> = ["A", "B", "C"];

  return (
    <div className="space-y-3">
      {/* Tabs A / B / C */}
      <div
        role="tablist"
        aria-label="Variantes de estilo visual"
        className="flex flex-wrap items-center gap-2"
      >
        {tabs.map((v) => {
          const opt = options.find((o) => o.variant === v);
          const selected = current === v;
          return (
            <button
              key={v}
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(v)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-amber-500 bg-amber-500/15 text-amber-200"
                  : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white"
              }`}
            >
              <span
                className={`inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  selected
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-700 text-slate-200"
                }`}
              >
                {v}
              </span>
              <span className="truncate max-w-[180px]">
                {opt?.meta.name || `Estilo ${v}`}
              </span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 text-xs">
          <button
            onClick={() => onPreviewModeChange("rendered")}
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
            onClick={() => onPreviewModeChange("source")}
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
      </div>

      {/* Iframe / source */}
      {previewMode === "rendered" ? (
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
          <iframe
            ref={iframeRef}
            srcDoc={currentOption.html}
            title={`Vista previa estilo ${current}`}
            className="w-full min-h-[360px] border-0"
            sandbox="allow-same-origin"
          />
        </div>
      ) : (
        <pre className="overflow-auto max-h-[480px] rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
          <code>{currentOption.html}</code>
        </pre>
      )}

      {/* Meta card */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {currentOption.meta.name}
            </p>
            {currentOption.meta.mood && (
              <p className="mt-0.5 text-xs text-slate-400">
                {currentOption.meta.mood}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Palette */}
          <div className="rounded-md border border-slate-700 bg-slate-900/50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <PaletteIcon className="size-3" />
              Paleta
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ColorSwatch
                label="Primario"
                hex={currentOption.meta.primaryColor}
              />
              <ColorSwatch
                label="Secundario"
                hex={currentOption.meta.secondaryColor}
              />
            </div>
          </div>

          {/* Typography */}
          <div className="rounded-md border border-slate-700 bg-slate-900/50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Type className="size-3" />
              Tipografía
            </p>
            <dl className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">Heading</dt>
                <dd className="text-slate-100 font-medium">
                  {currentOption.meta.fontHeading}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-400">Body</dt>
                <dd className="text-slate-100 font-medium">
                  {currentOption.meta.fontBody}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorSwatch({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-block size-7 rounded-full border border-slate-600 shadow-inner"
        style={{ backgroundColor: hex }}
      />
      <div className="leading-tight">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="font-mono text-xs text-slate-200">{hex}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BrandBookFinalPreview                                               */
/* ------------------------------------------------------------------ */

interface BrandBookFinalPreviewProps {
  brandBook: BrandBook;
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  projectId: string;
  phaseId: string;
  currentName: string;
}

/**
 * Final sub-step renderer for the IDENTITY phase.
 *
 * Shows a two-panel layout:
 *  - Left: sticky index sidebar with all Brand Book sections.
 *  - Right: scrollable rendering of the selected section (markdown).
 *
 * Also renders a meta summary card at the top with the project name,
 * voice summary, palette and typography extracted from the visual choice.
 */
function BrandBookFinalPreview({
  brandBook,
  activeSection,
  onSectionChange,
}: BrandBookFinalPreviewProps) {
  const active = brandBook.sections.find((s) => s.id === activeSection);
  const section = active || brandBook.sections[0];

  const { visualMeta } = brandBook.meta;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-0">
      {/* ── Left sidebar: index ── */}
      <div className="sm:w-56 sm:shrink-0 sm:sticky sm:top-0 sm:self-start sm:max-h-[calc(90vh-200px)] sm:overflow-y-auto">
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 space-y-1">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <BookOpen className="size-3" />
            Secciones
          </p>
          {brandBook.sections
            .sort((a, b) => a.order - b.order)
            .map((s) => {
              const isActive = s.id === activeSection;
              return (
                <button
                  key={s.id}
                  onClick={() => onSectionChange(s.id)}
                  className={`w-full text-left rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "bg-amber-500/15 text-amber-200 font-medium border-l-2 border-amber-500"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="size-3 shrink-0 opacity-60" />
                    <span className="truncate">{s.title}</span>
                  </span>
                </button>
              );
            })}
        </div>

        {/* Visual meta summary (compact) */}
        {visualMeta && (
          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/30 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Identidad visual
            </p>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-4 rounded-full border border-slate-600"
                style={{ backgroundColor: visualMeta.primaryColor }}
              />
              <span className="text-[10px] text-slate-400">
                {visualMeta.primaryColor}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-4 rounded-full border border-slate-600"
                style={{ backgroundColor: visualMeta.secondaryColor }}
              />
              <span className="text-[10px] text-slate-400">
                {visualMeta.secondaryColor}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {visualMeta.fontHeading} / {visualMeta.fontBody}
            </p>
          </div>
        )}
      </div>

      {/* ── Right: content ── */}
      <div className="flex-1 min-w-0 sm:pl-5 sm:border-l border-slate-800">
        {/* Project name header */}
        <div className="mb-4 pb-3 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">
            {brandBook.projectName}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Brand Book ·{" "}
            {new Date(brandBook.generatedAt).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
          {brandBook.meta.voiceSummary && (
            <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-2">
              {brandBook.meta.voiceSummary}
            </p>
          )}
        </div>

        {/* Section title */}
        <h3 className="mb-3 text-sm font-semibold text-amber-300 uppercase tracking-wide">
          {section.title}
        </h3>

        {/* Section content rendered as markdown */}
        <div
          className="markdown-body prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{
            __html: renderMarkdown(section.content),
          }}
        />
      </div>
    </div>
  );
}
