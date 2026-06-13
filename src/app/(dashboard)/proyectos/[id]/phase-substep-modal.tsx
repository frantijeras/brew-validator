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
  Printer,
} from "lucide-react";
import { renderMarkdown } from "@/components/markdown-renderer";
import {
  parseVisualArtifactContent,
  getVisualOption,
  type VisualStyleGuide,
} from "@/lib/identity-visual";
import { extractLogoSvgs } from "@/lib/identity-logo";
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
  // Aborts in-flight rename/preview requests when the modal unmounts, so we
  // never call setState on an unmounted component or act on a stale response.
  const renameAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => renameAbortRef.current?.abort();
  }, []);

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

  // ── Logo sub-step state (IDENTITY logo / 3c only) ──
  // El artefacto es un HTML con 12 logos en SVG. El usuario elige uno
  // (índice 1-based). Mostramos el HTML en un iframe + 12 chips de selección.
  const isLogoSubStep = useMemo(
    () => phaseType === "IDENTITY" && subStep === "logo",
    [phaseType, subStep]
  );
  const logoSvgs = useMemo(
    () => (isLogoSubStep ? extractLogoSvgs(subStepArtifact?.content) : []),
    [isLogoSubStep, subStepArtifact?.content]
  );
  const [selectedLogo, setSelectedLogo] = useState<number | null>(null);

  // Generación de PDF de la guía de estilo (3d) en cliente.
  const [pdfBusy, setPdfBusy] = useState(false);

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
      // Sync el logo elegido (3c) desde subStepChoice (índice 1-based).
      if (phaseType === "IDENTITY" && subStep === "logo" && subStepChoice) {
        const n = parseInt(String(subStepChoice).match(/(\d+)/)?.[1] ?? "", 10);
        setSelectedLogo(Number.isFinite(n) && n >= 1 ? n : null);
      } else {
        setSelectedLogo(null);
      }
      // NOTE: we do NOT reset successBanner here — it lives outside the
      // modal lifecycle (rendered as a fixed banner) and should only
      // clear itself on its own timer or on a new rename.
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

  // ── Domain verification for naming sub-step ──
  type DomainResult = { domain: string; available: boolean | null };
  const [domainResults, setDomainResults] = useState<DomainResult[]>([]);
  const [domainChecking, setDomainChecking] = useState(false);

  useEffect(() => {
    if (!open || phaseType !== "IDENTITY" || subStep !== "naming") return;
    if (options.length === 0) return;

    // Extract names from option labels: "Opci\u00f3n A: MeetScribe" → "MeetScribe"
    const names = options.map((opt) => {
      const cleaned = opt.label.replace(/^Opci[o\u00f3]n\s+\w+:\s*/i, "").split(/[\u2014\u2013-]/)[0].trim();
      return cleaned || opt.label;
    });

    if (names.length === 0) return;

    setDomainChecking(true);
    fetch("/api/domains/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.results) setDomainResults(data.results);
      })
      .catch(() => {
        // Domain check is non-blocking
      })
      .finally(() => setDomainChecking(false));
  }, [open, phaseType, subStep, options]);

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
    renameAbortRef.current = new AbortController();
    try {
      const res = await fetch(
        `/api/projects/${projectId}/rename/preview?newName=${encodeURIComponent(choice)}`,
        { method: "GET", signal: renameAbortRef.current.signal }
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
      // Modal closed mid-request — drop silently, don't touch state.
      if (err instanceof DOMException && err.name === "AbortError") return;
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
    renameAbortRef.current = new AbortController();
    try {
      // 1) First do RENAME — the endpoint verifies we're still in "naming" sub-step
      const renameRes = await fetch(`/api/projects/${projectId}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: choice, phaseId }),
        signal: renameAbortRef.current.signal,
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
      // Modal closed mid-request — drop silently.
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!options.suppressErrors) {
        setError(err instanceof Error ? err.message : "Error de conexión");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChoose() {
    // Sub-pasos "solo revisión" (p. ej. voz y tono): no hay opciones que elegir
    // ni campo libre — el usuario solo confirma (avanza) o itera. En ese caso
    // NO exigimos selección y confirmamos con un valor centinela.
    const isReviewOnly = options.length === 0 && !isFreeInput;
    if (!isReviewOnly && !selectedOption && !customValue.trim()) {
      setError("Selecciona una opción o escribe un valor");
      return;
    }
    const selectedOpt = selectedOption
      ? options.find((o) => o.value === selectedOption)
      : null;
    let choice =
      customValue.trim() ||
      selectedOpt?.label ||
      selectedOption ||
      (isReviewOnly ? "confirmado" : "");

    // Naming: el agente (desde 2026-06) pone el nombre real de la marca en
    // option.value, asi que esa es la fuente fiable (los labels nuevos
    // "Opcion A -- Nombre: gancho" romperian la limpieza legacy de abajo,
    // que produciria "Opcion A"). Los artifacts antiguos usaban "A"/"B"/"C"
    // como value (el nombre iba en el label) y siguen el camino legacy.
    const usedNamingValue =
      phaseType === "IDENTITY" &&
      subStep === "naming" &&
      !customValue.trim() &&
      !!selectedOpt?.value &&
      selectedOpt.value.trim().length > 2;
    if (usedNamingValue && selectedOpt) {
      choice = selectedOpt.value.trim();
    }

    // Para naming: limpiar prefijo "Opción X: " y sufijos como "(recomendado)"
    // para que el nombre elegido sea solo el texto real.
    if (phaseType === "IDENTITY" && subStep === "naming" && !usedNamingValue) {
      const match = choice.match(/^Opci[oó]n\s+\w+:\s*(.*)/i);
      if (match) {
        choice = match[1].trim();
      }
      // Remove common suffixes like "(recomendado)", "(recommended)", "(sugerido)", etc.
      choice = choice.replace(/\s*\((recomendad[oa]|recommended|sugerid[oa]|suggested|preferid[oa]|top)\)\s*/gi, "").trim();
      // Remove trailing dashes or separators like " — ..." or " - ..."
      choice = choice.split(/\s+[\u2014\u2013-]+\s+/)[0].trim();
    }

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
   * Descarga la **maqueta HTML** (3d): la variante elegida con el logotipo SVG
   * incrustado, como `index.html`.
   */
  function handleDownloadVisual() {
    if (!isVisualSubStep) return;
    const url = `/api/projects/${projectId}/phases/${phaseId}/substep/3d/template?variant=${visualVariant}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * "Ver" (3d): abre la vista integrada (Guía de Estilo + maqueta con
   * logotipo) en una pestaña nueva, cada panel aislado en su iframe.
   */
  function handleView3d() {
    if (!isVisualSubStep) return;
    const url = `/api/projects/${projectId}/phases/${phaseId}/substep/3d/view?variant=${visualVariant}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /**
   * "Descargar PDF" (3d): genera el PDF de la Guía de Estilo en el CLIENTE para
   * que el logotipo SVG quede renderizado/incrustado. Pide al servidor el HTML
   * autocontenible de la guía, lo renderiza en un iframe oculto y lo exporta
   * con html2canvas + jsPDF. Si algo falla, cae al PDF de servidor (texto).
   */
  async function handleDownloadStyleGuidePdf() {
    if (!isVisualSubStep) return;
    const base = `/api/projects/${projectId}/phases/${phaseId}/substep/3d/styleguide?variant=${visualVariant}`;
    setPdfBusy(true);
    let iframe: HTMLIFrameElement | null = null;
    try {
      const res = await fetch(`${base}&format=html`);
      if (!res.ok) throw new Error("styleguide html fetch failed");
      const html = await res.text();

      iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-same-origin");
      iframe.style.position = "fixed";
      iframe.style.left = "-10000px";
      iframe.style.top = "0";
      iframe.style.width = "840px";
      iframe.style.height = "10px";
      document.body.appendChild(iframe);
      await new Promise<void>((resolve) => {
        iframe!.addEventListener("load", () => resolve(), { once: true });
        iframe!.srcdoc = html;
      });
      // Pequeña espera para que fuentes/SVG terminen de pintar.
      await new Promise((r) => setTimeout(r, 350));

      const doc = iframe.contentDocument;
      const body = doc?.body;
      if (!doc || !body) throw new Error("iframe document not ready");

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(body, {
        scale: 2,
        backgroundColor: "#ffffff",
        windowWidth: 840,
      });

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const img = canvas.toDataURL("image/png");
      if (imgH <= pageH) {
        pdf.addImage(img, "PNG", 0, 0, imgW, imgH);
      } else {
        let y = 0;
        while (y < imgH) {
          pdf.addImage(img, "PNG", 0, -y, imgW, imgH);
          y += pageH;
          if (y < imgH) pdf.addPage();
        }
      }
      pdf.save("guia-estilos.pdf");
    } catch {
      // Fallback: PDF de servidor (texto, sin SVG rasterizado).
      const a = document.createElement("a");
      a.href = base;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      setPdfBusy(false);
    }
  }

  /**
   * Descarga del artefacto de logos (3c). Sin `svg` → HTML con las 12
   * propuestas; con `svg=N` → solo el SVG elegido.
   */
  function handleDownloadLogo(opts: { onlySvg?: boolean } = {}) {
    if (!isLogoSubStep) return;
    const base = `/api/projects/${projectId}/phases/${phaseId}/substep/logo-download`;
    const url =
      opts.onlySvg && selectedLogo != null
        ? `${base}?svg=${selectedLogo}`
        : base;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * "Usar este logo" — sub-fase 3c. Guarda el índice elegido (1-based) y
   * avanza a la sub-fase `visual` (3d), que incrustará el SVG elegido en la
   * maqueta.
   */
  async function handleLogoChoose() {
    if (!isLogoSubStep || selectedLogo == null) {
      setError("Elige uno de los logotipos");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/phases/${phaseId}/substep/choose`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            choice: String(selectedLogo),
            nextSubStep: "visual",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al confirmar el logotipo");
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
   * "Usar este estilo" — visual sub-step (3d) flow.
   * Calls /substep/choose with the current variant (A/B/C). Al ser el ÚLTIMO
   * sub-paso de IDENTITY, el endpoint CIERRA la fase (sin Brand Book) y arranca
   * automáticamente la siguiente. Por eso NO enviamos `nextSubStep`.
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
    logo: "Elige un logotipo",
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
                isLogoSubStep ? (
                  <LogoSubStepPreview
                    html={artifactContent}
                    svgCount={logoSvgs.length}
                    selected={selectedLogo}
                    onSelect={setSelectedLogo}
                    iframeRef={iframeRef}
                    previewMode={previewMode}
                    onPreviewModeChange={setPreviewMode}
                  />
                ) : isVisualSubStep && visualContent ? (
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
                      // En naming, el agente pone el NOMBRE real de la marca en
                      // `opt.value` (ej. "Growza"), así que lo mostramos tal cual
                      // en el botón en vez de "Opción A". Para el resto (o values
                      // legacy "A"/"B"/"C") extraemos el nombre del label.
                      const isNamingValue =
                        phaseType === "IDENTITY" &&
                        subStep === "naming" &&
                        !!opt.value &&
                        opt.value.trim().length > 2;
                      const displayName = isNamingValue
                        ? opt.value.trim()
                        : opt.label.replace(/^Opci[oó]n\s+\w+:\s*/i, '').split(/[—–-]/)[0].trim() || opt.label;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setSelectedOption(opt.value);
                            setCustomValue("");
                          }}
                          disabled={submitting}
                          className={`border px-3 py-3 text-left text-sm transition-all disabled:opacity-50 ${
                            selected
                              ? "border-amber-500 bg-amber-500/10 text-white"
                              : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700/50 active:bg-slate-700"
                          }`}
                        >
                          <span className="font-medium">{displayName}</span>
                          {/* Domain badges for naming sub-step */}
                          {phaseType === "IDENTITY" && subStep === "naming" && domainResults.length > 0 && (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {[".es", ".com", ".io"].map((suffix) => {
                                const slug = displayName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
                                const domain = `${slug}${suffix}`;
                                const result = domainResults.find((r) => r.domain === domain);
                                const isAvailable = result?.available;
                                return (
                                  <span
                                    key={suffix}
                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                      isAvailable === true
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : isAvailable === false
                                          ? "bg-red-500/15 text-red-400"
                                          : "bg-slate-700/50 text-slate-400"
                                    }`}
                                  >
                                    {suffix}
                                    {isAvailable === true ? " \u2713" : isAvailable === false ? " \u2717" : domainChecking ? " ..." : " ?"}
                                  </span>
                                );
                              })}
                            </span>
                          )}
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
                {isLogoSubStep ? (
                  <>
                    <button
                      onClick={() => handleDownloadLogo()}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                    >
                      <Download className="size-4" />
                      Descargar
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
                      onClick={handleLogoChoose}
                      disabled={submitting || selectedLogo == null}
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
                          {selectedLogo != null
                            ? `Usar logo ${selectedLogo}`
                            : "Usar este logo"}
                        </>
                      )}
                    </button>
                  </>
                ) : isVisualSubStep ? (
                  <>
                    <button
                      onClick={handleView3d}
                      disabled={submitting || pdfBusy || !currentVisualOption}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                    >
                      <Eye className="size-4" />
                      Ver
                    </button>
                    <button
                      onClick={handleDownloadVisual}
                      disabled={submitting || pdfBusy || !currentVisualOption}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                    >
                      <Download className="size-4" />
                      Descargar HTML
                    </button>
                    <button
                      onClick={handleDownloadStyleGuidePdf}
                      disabled={submitting || pdfBusy || !currentVisualOption}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                    >
                      {pdfBusy ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Generando PDF…
                        </>
                      ) : (
                        <>
                          <Printer className="size-4" />
                          Descargar PDF
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowIterate(true)}
                      disabled={submitting || pdfBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600 disabled:opacity-50"
                    >
                      <RefreshCw className="size-4" />
                      Iterar
                    </button>
                    <button
                      onClick={handleVisualChoose}
                      disabled={submitting || pdfBusy || !currentVisualOption}
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
/* LogoSubStepPreview (sub-fase 3c)                                    */
/* ------------------------------------------------------------------ */

interface LogoSubStepPreviewProps {
  /** HTML completo con las 12 propuestas de logo en SVG. */
  html: string;
  /** Número de logos detectados en el HTML (para los chips de selección). */
  svgCount: number;
  /** Índice 1-based del logo elegido, o null. */
  selected: number | null;
  onSelect: (n: number) => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  previewMode: "rendered" | "source";
  onPreviewModeChange: (m: "rendered" | "source") => void;
}

/**
 * Renderizador de la sub-fase 3c (Logotipo):
 *   - Toolbar Vista previa / HTML.
 *   - Iframe con las 12 propuestas (o el HTML fuente).
 *   - Rejilla de chips numerados (1..N) para ELEGIR un logo.
 *
 * El HTML llega del agente con N `.logo-card`; mostramos `svgCount` chips
 * (normalmente 12). El usuario pulsa un número para elegir y luego confirma
 * en el footer con "Usar logo N".
 */
function LogoSubStepPreview({
  html,
  svgCount,
  selected,
  onSelect,
  iframeRef,
  previewMode,
  onPreviewModeChange,
}: LogoSubStepPreviewProps) {
  // Si por alguna razón no se detectan SVGs, ofrecemos al menos 12 chips
  // (el prompt garantiza 12 propuestas) para no bloquear la elección.
  const count = svgCount > 0 ? svgCount : 12;
  const chips = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 text-xs">
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

      {/* Iframe / source */}
      {previewMode === "rendered" ? (
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title="12 propuestas de logotipo"
            className="w-full min-h-[360px] border-0"
            sandbox="allow-same-origin"
          />
        </div>
      ) : (
        <pre className="overflow-auto max-h-[480px] rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
          <code>{html}</code>
        </pre>
      )}

      {/* Selección de logo (chips numerados) */}
      <div>
        <p className="mb-2 text-sm font-medium text-white">
          Elige un logotipo
        </p>
        <div className="flex flex-wrap gap-2">
          {chips.map((n) => {
            const isSel = selected === n;
            return (
              <button
                key={n}
                onClick={() => onSelect(n)}
                aria-pressed={isSel}
                className={`inline-flex size-10 items-center justify-center rounded-md border text-sm font-bold transition-colors ${
                  isSel
                    ? "border-amber-500 bg-amber-500 text-slate-950"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700/60"
                }`}
                title={`Logotipo ${n}`}
              >
                {n}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Las propuestas se numeran de izquierda a derecha y de arriba abajo en
          la vista previa.
        </p>
      </div>
    </div>
  );
}

