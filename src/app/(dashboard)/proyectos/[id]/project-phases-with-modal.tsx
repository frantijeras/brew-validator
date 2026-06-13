"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  FileText,
  Brain,
  Palette,
  TrendingUp,
  Code,
  HelpCircle,
  X,
  XCircle,
  BriefcaseBusiness,
  Rocket,
  FileCheck,
  Download,
  Eye,
  Save,
  Info,
  Edit3,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { PhaseActionButton } from "./phase-action-button";
import { PhaseQuestionsModal } from "./phase-questions-modal";
import { PhaseSubstepModal, type SubStepArtifact } from "./phase-substep-modal";
import { PhaseCard } from "./phase-card";
import { KebabMenu, type KebabItem } from "@/components/kebab-menu";
import { ContentSubpage, type SubpageView } from "./content-subpage";
import {
  PHASE_SUBSTEPS,
  getSubStepIndex,
  subStepToneMap,
  type SubStepMeta,
} from "@/lib/phase-substeps";
import {
  formatMemoryValue,
  memoryKeyLabels,
  type ProjectMemory,
  type MemoryEntry,
} from "@/lib/project-memory";
import { SubStepCard, type SubStepStatus } from "./sub-step-card";
import type { PhaseError } from "@/lib/phase-errors";
import { useReactivePolling } from "@/hooks/use-reactive-polling";

interface PhaseData {
  id: string;
  type: string;
  label: string;
  description: string | null;
  status: string;
  sortOrder: number;
  artifacts: Array<{ title: string; type: string }> | null;
  questions: Array<{ id: string; label: string; type: string }> | null;
  /** El usuario ya respondió el quiz (respuestas persistidas en la fase). */
  hasAnswers?: boolean;
  subStep: string | null;
  subStepOrder: number | null;
  subStepArtifact: { type?: "html" | "markdown"; content?: string; options?: Array<{ value: string; label: string }> } | null;
  subStepChoice: string | null;
  lastError?: PhaseError | null;
  /** ISO timestamp del último cambio (≈ entrada en PROCESSING) para el contador. */
  updatedAt?: string;
}

interface ProjectPhasesWithModalProps {
  projectId: string;
  ideaId: string;
  projectName: string;
  phases: PhaseData[];
  memory: ProjectMemory | null;
}

const phaseIcons: Record<string, React.ReactNode> = {
  IDENTITY: <Palette className="size-5" />,
  ANALYSIS: <TrendingUp className="size-5" />,
  CONTENT: <FileText className="size-5" />,
  BUSINESS: <BriefcaseBusiness className="size-5" />,
  EXECUTION: <Rocket className="size-5" />,
};

const phaseColors: Record<string, string> = {
  IDENTITY: "text-purple-400 border-purple-500/30",
  ANALYSIS: "text-blue-400 border-blue-500/30",
  CONTENT: "text-amber-400 border-amber-500/30",
  BUSINESS: "text-cyan-400 border-cyan-500/30",
  EXECUTION: "text-orange-400 border-orange-500/30",
};

const phaseBgColors: Record<string, string> = {
  IDENTITY: "bg-purple-500/10",
  ANALYSIS: "bg-blue-500/10",
  CONTENT: "bg-amber-500/10",
  BUSINESS: "bg-cyan-500/10",
  EXECUTION: "bg-orange-500/10",
};

/**
 * Phase 4 refactor: the download + view buttons are now CONSISTENT across
 * all phases (and across the validation phase 0). Both buttons say the
 * same thing regardless of phase type:
 *   - Left:  "Ver"              (secondary outline, opens HTML in new tab)
 *   - Right: "Descargar PDF"    (primary download, attachment PDF)
 *
 * The previous per-phase download labels (e.g. "Descargar brand book")
 * are gone — keeping them was inconsistent and the user explicitly
 * asked for symmetric, predictable labels.
 */
const PHASE4_VIEW_LABEL = "Ver";
const PHASE4_DOWNLOAD_LABEL = "Descargar PDF";

/**
 * Human label for the "Revisar" button shown when a phase is in
 * SUBSTEP_READY. The label depends on the kind of sub-step, not the phase
 * type — e.g. branding's "naming" sub-step shows "Revisar nombres", while
 * dev's "compare" sub-step shows "Revisar comparativa".
 */
const subStepReviewLabels: Record<string, string> = {
  naming: "Revisar nombres",
  voice: "Revisar voz",
  logo: "Elegir logotipo",
  visual: "Revisar estilo",
  compare: "Revisar comparativa",
  simulate: "Revisar simulación",
  pilars: "Revisar pilares",
  generate: "Revisar preguntas",
  final: "Revisar resultado",
};

const subStepExecuteLabels: Record<string, string> = {
  quiz: "Responder",
  naming: "Iniciar",
  voice: "Iniciar",
  logo: "Iniciar",
  visual: "Iniciar",
  pilars: "Iniciar",
  compare: "Iniciar",
  simulate: "Iniciar",
  generate: "Iniciar",
  final: "Iniciar",
};

const subStepProcessingMessages: Record<string, string> = {
  quiz: "Procesando respuestas...",
  naming: "Generando opciones...",
  voice: "Definiendo personalidad...",
  logo: "Generando logotipos...",
  visual: "Generando estilo...",
  pilars: "Generando pilares...",
  compare: "Comparando stacks...",
  simulate: "Simulando escenarios...",
  generate: "Generando preguntas...",
  final: "Consolidando documento...",
};

/**
 * Determina el estado visual de un sub-step card.
 * Sigue el algoritmo de la sección 5.1 de la especificación.
 */
function getSubStepStatus(
  phase: PhaseData,
  subStepMeta: SubStepMeta,
  phaseStatus: string
): SubStepStatus {
  if (phaseStatus === "COMPLETED") return "completed";
  if (phaseStatus === "LOCKED") return "locked";

  if (phaseStatus === "AVAILABLE") {
    // For IDENTITY, a phase reset to AVAILABLE after a sub-step failed keeps
    // its position in `subStep`/`subStepOrder`. Sub-steps are independent:
    // earlier ones stay completed and the user retries ONLY the current one —
    // we never force a restart from `naming`. A fresh phase (no subStep) has
    // currentIdx 0, so only the first sub-step is available.
    if (phase.type === "IDENTITY") {
      const currentIdx =
        phase.subStepOrder !== null && phase.subStepOrder !== undefined
          ? phase.subStepOrder
          : phase.subStep
            ? getSubStepIndex(phase.subStep, phase.type)
            : 0;
      if (subStepMeta.order < currentIdx) return "completed";
      if (subStepMeta.order === currentIdx) return "available";
      return "locked";
    }
    return subStepMeta.order === 0 ? "available" : "locked";
  }

  if (phaseStatus === "PROCESSING") {
    const currentIdx =
      phase.subStepOrder !== null && phase.subStepOrder !== undefined
        ? phase.subStepOrder
        : phase.subStep
          ? getSubStepIndex(phase.subStep, phase.type)
          : 0;

    if (subStepMeta.order < currentIdx) return "completed";
    if (subStepMeta.order === currentIdx) return "processing";
    return "locked";
  }

  if (phaseStatus === "SUBSTEP_READY") {
    const currentIdx =
      phase.subStepOrder !== null && phase.subStepOrder !== undefined
        ? phase.subStepOrder
        : phase.subStep
          ? getSubStepIndex(phase.subStep, phase.type)
          : 0;

    if (subStepMeta.order < currentIdx) return "completed";
    if (subStepMeta.order === currentIdx) return "substep_ready";
    return "locked";
  }

  if (phaseStatus === "QUESTIONING") {
    // Quiz sub-step shows as available (clickable to open questions modal)
    // For IDENTITY phases, the current sub-step should also be available
    // (to allow restarting with mode "report" after a previous failed attempt)
    if (subStepMeta.id === "quiz") return "available";
    if (phase.type === "IDENTITY") {
      const currentIdx =
        phase.subStepOrder !== null && phase.subStepOrder !== undefined
          ? phase.subStepOrder
          : phase.subStep
            ? getSubStepIndex(phase.subStep, phase.type)
            : 0;
      if (subStepMeta.order === currentIdx) return "available";
    }
    return "locked";
  }

  return "locked";
}

/**
 * Estilos de los 4 tipos de botón que aparecen en cada tarjeta de fase.
 * - `primary`: acción principal que ejecuta (Ejecutar, Responder, Ver detalles de fase 0).
 *   Fondo ámbar sólido, texto oscuro. Ocupa 50% del ancho en desktop (via wrapper).
 * - `download`: descargar artefacto completado. Estilo "ghost" oscuro con borde.
 * - `cancel`: cancelar/reiniciar fase. Compacto, sin border-fuerte, hover rojo.
 * - `status`: pills de solo-lectura. Variantes por estado (processing / completed / locked).
 *
 * Regla: NUNCA estilos inline. Todo se aplica vía clases Tailwind. El wrapper externo
 * (`sm:w-1/2 sm:ml-auto` en desktop) hace que el botón ocupe el 50% del ancho de la
 * tarjeta y quede alineado a la derecha. En móvil, `w-full` lo expande dentro de su
 * celda del grid 2-columnas del padre.
 */
const btnStyles = {
  primary:
    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed",
  secondary:
    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-slate-700/60 hover:border-slate-600",
  download:
    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600",
  downloadDisabled:
    "inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm font-medium text-slate-600",
  cancel:
    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300",
} as const;

/** Dispara una descarga nativa sin abrir pestaña. */
function triggerDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * URLs de "Ver" y "Descargar" de un sub-paso de la Fase 3 ya completado.
 * Cada sub-paso tiene una salida distinta:
 *  - naming/voice → markdown: Ver (HTML) + Descargar (PDF).
 *  - logo (3c)    → HTML con 12 SVG: Ver (rejilla) + Descargar (SVG elegido).
 *  - visual (3d)  → maqueta + guía: Ver (integrado) + Descargar HTML + PDF.
 */
function subStepViewSpec(
  projectId: string,
  phaseId: string,
  subStepId: string,
  visualChoice: string | null
): { viewUrl: string; downloads: Array<{ label: string; href: string }> } {
  const base = `/api/projects/${projectId}/phases/${phaseId}/substep`;
  if (subStepId === "visual") {
    const v = visualChoice && ["A", "B", "C"].includes(visualChoice) ? visualChoice : "A";
    return {
      viewUrl: `${base}/3d/view?variant=${v}`,
      downloads: [
        { label: "Descargar HTML", href: `${base}/3d/template?variant=${v}` },
        { label: "Descargar PDF", href: `${base}/3d/styleguide?variant=${v}` },
      ],
    };
  }
  if (subStepId === "logo") {
    return {
      viewUrl: `${base}/history?subStep=logo&action=view`,
      downloads: [{ label: "Descargar SVG", href: `${base}/history?subStep=logo&action=download&svg=` }],
    };
  }
  return {
    viewUrl: `${base}/history?subStep=${subStepId}&action=view`,
    downloads: [{ label: "Descargar PDF", href: `${base}/history?subStep=${subStepId}&action=download` }],
  };
}

/**
 * Wrapper de la zona de acciones de cada tarjeta de fase.
 *
 * Layout: en móvil (<sm), grid de 2 columnas para que primario y secundario
 * vayan lado a lado. En desktop (≥sm), contenedor flexible que ocupa el
 * 50% del ancho de la tarjeta y se alinea a la derecha, con dos columnas
 * internas (leftCol/rightCol) para colocar los botones.
 *
 * El usuario quiere:
 *   - Acciones que EJECUTAN (Ejecutar, Responder, Descargar, Revisar, Procesando)
 *     → a la DERECHA (rightCol)
 *   - Acciones SECUNDARIAS (Ver detalles de fase 0, Cancelar)
 *     → a la IZQUIERDA (leftCol)
 */

export function ProjectPhasesWithModal({
  projectId,
  ideaId,
  projectName,
  phases,
  memory,
}: ProjectPhasesWithModalProps) {
  const [modalPhase, setModalPhase] = useState<PhaseData | null>(null);
  const [substepModalPhase, setSubstepModalPhase] = useState<PhaseData | null>(null);
  const [localMemory, setLocalMemory] = useState<ProjectMemory | null>(memory);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  // Error message per sub-step launch, keyed by `${phaseId}:${subStepId}`.
  const [subStepErrors, setSubStepErrors] = useState<Record<string, string>>({});
  // In-flight guard so a double-click can't fire two execute-phase jobs.
  const inFlightSubSteps = useRef<Set<string>>(new Set());
  // Rollback (Regresión en cascada): fase que el usuario quiere REHACER. Al
  // confirmar, se borran las fases posteriores. `null` = sin confirmación abierta.
  const [rollbackPhase, setRollbackPhase] = useState<PhaseData | null>(null);
  // Guard de doble click + spinner mientras se ejecuta el rollback.
  const [rollbackInFlight, setRollbackInFlight] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  // Subpágina in-app (sin modal ni pestaña nueva) para "Ver" de fases y
  // sub-fases — misma lógica de navegación que la Fase 1 (Validación).
  const [subpage, setSubpage] = useState<SubpageView | null>(null);
  // Rehacer sub-paso (cascada): confirmación pendiente.
  const [substepRollback, setSubstepRollback] = useState<{
    phaseId: string;
    subStep: string;
    label: string;
  } | null>(null);
  const router = useRouter();

  async function handleSubstepRollback() {
    if (!substepRollback || rollbackInFlight) return;
    setRollbackInFlight(true);
    setRollbackError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/phases/${substepRollback.phaseId}/substep/${substepRollback.subStep}/rollback`,
        { method: "POST" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Error ${res.status}`);
      }
      setSubstepRollback(null);
      window.dispatchEvent(new CustomEvent("project-changed"));
      router.refresh();
    } catch (err) {
      setRollbackError(err instanceof Error ? err.message : "Error al rehacer el sub-paso");
    } finally {
      setRollbackInFlight(false);
    }
  }

  // Launch an IDENTITY/quiz sub-step. Guards against double-submission and
  // surfaces network/API errors instead of swallowing them (previously a
  // bare `.catch(() => {})` left the UI stale on failure).
  const runSubStep = useCallback(
    async (
      phaseId: string,
      phaseType: string,
      subStepId: string,
      mode: "report" | "questions"
    ) => {
      const key = `${phaseId}:${subStepId}`;
      if (inFlightSubSteps.current.has(key)) return;
      inFlightSubSteps.current.add(key);
      setSubStepErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        const res = await fetch("/api/projects/execute-phase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, phaseId, phaseType, mode, subStep: subStepId }),
        });
        if (res.ok) {
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          setSubStepErrors((prev) => ({
            ...prev,
            [key]: data?.error || "No se pudo iniciar el sub-paso. Inténtalo de nuevo.",
          }));
        }
      } catch {
        setSubStepErrors((prev) => ({
          ...prev,
          [key]: "Error de conexión. Inténtalo de nuevo.",
        }));
      } finally {
        inFlightSubSteps.current.delete(key);
      }
    },
    [projectId, router]
  );

  // Sync localMemory when parent memory changes
  useEffect(() => {
    setLocalMemory(memory);
  }, [memory]);



  // Auto-poll: refresh when a phase is PROCESSING / QUESTIONING / SUBSTEP_READY
  // so cancel/refresh is visible. We also poll when the sub-step modal is
  // open and the user has just confirmed — the parent will see PROCESSING
  // and then SUBSTEP_READY again when the next job finishes.
  const isAnyProcessingOrQuestioning = phases.some(
    (p) =>
      p.status === "PROCESSING" ||
      p.status === "QUESTIONING" ||
      p.status === "SUBSTEP_READY"
  );

  // Poll while a phase is active, and refresh instantly when the user returns
  // to the tab (fixes "the phase finished but the UI is stale until I reload").
  useReactivePolling(isAnyProcessingOrQuestioning, 3000);

  async function handleCancelPhase(phaseId: string) {
    try {
      const res = await fetch("/api/projects/cancel-phase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseId }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Error canceling phase:", data.error);
      }
      router.refresh();
    } catch (err) {
      console.error("Error canceling phase:", err);
    }
  }

  // ── Rollback (Regresión en cascada) ──
  // Rehace la fase objetivo: el endpoint borra de la BDD (Base de datos) todos
  // los artefactos/estados de las fases POSTERIORES y deja la objetivo en
  // AVAILABLE. Tras la respuesta hacemos `router.refresh()` para PURGAR el
  // estado global del frontend (re-fetch del Server Component) y evitar
  // renderizar "datos fantasma" de las fases que ya no son válidas. Además,
  // cerramos cualquier modal abierto cuya fase haya podido quedar reseteada.
  async function handleRollback(phase: PhaseData) {
    if (rollbackInFlight) return;
    setRollbackInFlight(true);
    setRollbackError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/phases/${phase.id}/rollback`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRollbackError(
          data?.error || "No se pudo rehacer la fase. Inténtalo de nuevo."
        );
        return;
      }
      // Purgar estado local cacheado de fases posteriores: cerramos modales que
      // pudieran apuntar a una fase ya reseteada y limpiamos errores de sub-paso.
      setModalPhase(null);
      setSubstepModalPhase(null);
      setSubpage(null);
      setSubStepErrors({});
      inFlightSubSteps.current.clear();
      setRollbackPhase(null);
      // Re-fetch del estado de servidor → invalida el árbol cacheado del cliente.
      router.refresh();
    } catch {
      setRollbackError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setRollbackInFlight(false);
    }
  }

  // ── Memory edit handlers ──
  function openMemoryModal() {
    // Populate edit fields from current memory values (for known keys)
    const fields: Record<string, string> = {};
    if (localMemory) {
      for (const [key, entry] of Object.entries(localMemory)) {
        if (entry && entry.value !== null && entry.value !== undefined) {
          fields[key] = typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value);
        }
      }
    }
    setEditFields(fields);
    setShowMemoryModal(true);
  }

  async function handleSaveMemory() {
    setSavingMemory(true);
    try {
      const memoryPatch: Record<string, MemoryEntry> = {};
      const now = new Date().toISOString();
      for (const [key, value] of Object.entries(editFields)) {
        if (value.trim()) {
          memoryPatch[key] = {
            value: value.trim(),
            source: "user",
            updatedAt: now,
          };
        }
      }
      const res = await fetch(`/api/projects/${projectId}/memory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory: memoryPatch }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Error saving memory:", data.error);
      } else {
        const data = await res.json();
        setLocalMemory(data.memory as ProjectMemory);
        setShowMemoryModal(false);
      }
    } catch (err) {
      console.error("Error saving memory:", err);
    } finally {
      setSavingMemory(false);
    }
  }

  // ── Build the banner text ──
  const memoryEntries = localMemory
    ? Object.entries(localMemory)
        .filter(([, e]) => e && e.value !== null && e.value !== undefined)
        .sort((a, b) => {
          const dateA = a[1]?.updatedAt ?? "";
          const dateB = b[1]?.updatedAt ?? "";
          return dateB.localeCompare(dateA); // most recent first
        })
    : [];

  return (
    <>
      {/* Subpágina de contenido ("Ver"): cuando está activa REEMPLAZA la lista
          de fases (misma lógica que la Fase 1). */}
      {subpage && (
        <ContentSubpage view={subpage} onBack={() => setSubpage(null)} />
      )}

      {/* Contenedor de TODAS las tarjetas de fase: grid de 2 columnas en
          desktop (dos fases por fila). La Fase 3 (IDENTITY) y el banner de
          decisiones ocupan la fila completa (`md:col-span-2`). En móvil cae a
          una sola columna. `items-start` evita que tarjetas de distinta altura
          se estiren entre sí. */}
      <div
        className={`grid grid-cols-1 items-start gap-3 md:grid-cols-2 ${
          subpage ? "hidden" : ""
        }`}
      >
{/* Fase 00 — Validación de Idea eliminada: ahora tiene su propia pestaña independiente (tab 1). */}

        {/* 📌 Memory banner — decisiones vigentes (fila completa) */}
        {memoryEntries.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 md:col-span-2">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-400" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-amber-400">
                  Decisiones vigentes:
                </span>{" "}
                <span className="text-xs text-slate-300">
                  {memoryEntries.slice(0, 5).map(([key, entry], i) => (
                    <span key={key}>
                      {i > 0 && " | "}
                      <span className="text-amber-400/80">
                        {memoryKeyLabels[key] ?? key}
                      </span>
                      =
                      <span className="text-white">
                        {formatMemoryValue(entry!.value)}
                      </span>
                      {entry!.source && (
                        <span className="text-slate-500">
                          {" "}
                          ({entry!.source === "user" ? "usuario" : `Fase ${entry!.source}`})
                        </span>
                      )}
                    </span>
                  ))}
                  {memoryEntries.length > 5 && (
                    <span className="text-slate-500">
                      {" "}
                      +{memoryEntries.length - 5} más
                    </span>
                  )}
                </span>
              </div>
              <button
                onClick={openMemoryModal}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20 hover:border-amber-500/50"
              >
                <Edit3 className="size-3" />
                Editar
              </button>
            </div>
          </div>
        )}

        {phases
          .map((phase) => {
          const isLocked = phase.status === "LOCKED";
          const isCompleted = phase.status === "COMPLETED";
          const isAvailable = phase.status === "AVAILABLE";
          const isQuestioning = phase.status === "QUESTIONING";
          const isProcessing = phase.status === "PROCESSING";
          const isSubstepReady = phase.status === "SUBSTEP_READY";
          const artifacts = phase.artifacts as Array<{ title: string; type: string }> | null;
          const questions = phase.questions as Array<{ id: string; label: string; type: string }> | null;
          // Normalize subStepArtifact so `type` is always defined (default
          // to "markdown" if the JSON lacks it).
          const subStepArtifact: SubStepArtifact | null = phase.subStepArtifact
            ? {
                type: (phase.subStepArtifact.type as "html" | "markdown") || "markdown",
                content: phase.subStepArtifact.content || "",
                options: phase.subStepArtifact.options,
              }
            : null;

          const hasQuestions = isQuestioning && questions && questions.length > 0;
          const hasArtifacts = isCompleted && artifacts && artifacts.length > 0;

          // Label contextual para el spinner de procesamiento.
          // Si la fase ya tiene preguntas generadas -> "Generando informe..."
          // Si esta arrancando (no hay preguntas) -> "Generando preguntas..."
          const processingLabel =
            phase.questions && Array.isArray(phase.questions) && phase.questions.length > 0
              ? "Generando informe..."
              : "Generando preguntas...";

          const reviewLabel =
            (phase.subStep && subStepReviewLabels[phase.subStep]) || "Revisar sub-paso";

          // ── Sub-step cards (nuevo: reemplaza subProgress y miniProgressBar) ──
          // Solo para fases con definición en PHASE_SUBSTEPS (todas excepto ANALYSIS).
          const phaseSubsteps = PHASE_SUBSTEPS[phase.type];
          const hasSubSteps = phaseSubsteps && phaseSubsteps.length > 0;

          const phaseTone = subStepToneMap[phase.type] || "blue";

          let subStepCards: React.ReactNode = null;
          if (hasSubSteps && !isLocked) {
            subStepCards = phaseSubsteps!.map((meta) => {
              const sStatus = getSubStepStatus(phase, meta, phase.status);
              const executeLabel = meta.id === "quiz" && isQuestioning ? "Responder" : (subStepExecuteLabels[meta.id] || "Iniciar");
              const reviewLabel = subStepReviewLabels[meta.id] || "Revisar";
              const processingMsg = subStepProcessingMessages[meta.id] || "Generando...";

              // Determinar onAction según el estado y tipo de sub-step
              let onAction: (() => void) | undefined;
              if (sStatus === "available") {
                // Si el sub-step actual tiene preguntas activas, abrir modal
                if ((hasQuestions || (isQuestioning && meta.id === "quiz")) && meta.id === "quiz") {
                  onAction = () => setModalPhase(phase);
                } else {
                  // IDENTITY sub-steps use "report" mode and can be launched at
                  // ANY order (including retrying a failed sub-step like
                  // "visual" without restarting from "naming"). Other phases
                  // launch only their first sub-step (quiz) in "questions" mode.
                  const isIdentitySubStep = ["naming", "voice", "logo", "visual"].includes(meta.id);
                  if (isIdentitySubStep || meta.order === 0) {
                    const executeMode = isIdentitySubStep ? "report" : "questions";
                    onAction = () =>
                      runSubStep(phase.id, phase.type, meta.id, executeMode);
                  }
                }
              } else if (sStatus === "substep_ready") {
                onAction = () =>
                  setSubstepModalPhase({ ...phase, subStepArtifact });
              }

              const subStepErrorKey = `${phase.id}:${meta.id}`;

              // Al COMPLETAR el sub-paso (Fase 3): botón "Ver" (visor in-app) en
              // la tarjeta + menú kebab con Descargar(s) y Rehacer (cascada).
              let ssActions: React.ReactNode | undefined;
              let ssMenu: React.ReactNode | undefined;
              if (sStatus === "completed" && phase.type === "IDENTITY") {
                const spec = subStepViewSpec(projectId, phase.id, meta.id, phase.subStepChoice);
                // La subfase visual (3d) se ve con pestañas Guía de Estilo /
                // Maqueta; el resto (naming/voice) inline en markdown oscuro;
                // los logos (HTML autónomo) enmarcados.
                const base = `/api/projects/${projectId}/phases/${phase.id}/substep`;
                const variant =
                  phase.subStepChoice && ["A", "B", "C"].includes(phase.subStepChoice)
                    ? phase.subStepChoice
                    : "A";
                const openView = () => {
                  if (meta.id === "visual") {
                    setSubpage({
                      kind: "frames",
                      title: meta.label,
                      tabs: [
                        { id: "guia", label: "Guía de Estilo", url: `${base}/3d/view?variant=${variant}&part=guia` },
                        { id: "maqueta", label: "Maqueta", url: `${base}/3d/view?variant=${variant}&part=maqueta` },
                      ],
                      downloads: spec.downloads,
                    });
                  } else if (meta.id === "logo") {
                    setSubpage({
                      kind: "frames",
                      title: meta.label,
                      tabs: [{ id: "logos", label: "Logotipos", url: spec.viewUrl }],
                      downloads: spec.downloads,
                    });
                  } else {
                    setSubpage({
                      kind: "markdown",
                      title: meta.label,
                      url: `${base}/history?subStep=${meta.id}&action=json`,
                      downloads: spec.downloads,
                    });
                  }
                };
                ssActions = (
                  <button
                    type="button"
                    onClick={openView}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-white md:w-auto"
                  >
                    <Eye className="size-3.5" /> Ver
                  </button>
                );
                const menuItems: KebabItem[] = [
                  ...spec.downloads.map((d) => ({
                    label: d.label,
                    icon: <Download className="size-3.5" />,
                    onClick: () => triggerDownload(d.href),
                  })),
                  {
                    label: "Rehacer este paso",
                    icon: <RotateCcw className="size-3.5" />,
                    danger: true,
                    onClick: () =>
                      setSubstepRollback({ phaseId: phase.id, subStep: meta.id, label: meta.label }),
                  },
                ];
                ssMenu = <KebabMenu items={menuItems} />;
              }

              return (
                <SubStepCard
                  key={meta.id}
                  phaseType={phase.type}
                  subStepMeta={meta}
                  status={sStatus}
                  number={meta.order + 1}
                  tone={phaseTone}
                  onAction={onAction}
                  executeLabel={executeLabel}
                  reviewLabel={reviewLabel}
                  processingMessage={processingMsg}
                  processingSince={phase.updatedAt}
                  errorMessage={subStepErrors[subStepErrorKey]}
                  actions={ssActions}
                  menu={ssMenu}
                />
              );
            });
          }

          // La Fase 3 (IDENTITY) ocupa la fila completa del grid y muestra sus
          // subfases en 2 columnas internas (`wide`). El resto de fases caben
          // en media fila con subfases apiladas.
          const isWide = phase.type === "IDENTITY";

          return (
            <div key={phase.id} className={isWide ? "md:col-span-2" : ""}>
            <PhaseCard
              number={phase.sortOrder}
              title={phase.label}
              description={phase.description ?? undefined}
              subSteps={subStepCards}
              wide={isWide}
              icon={phaseIcons[phase.type] || <Brain className="size-5" />}
              status={(() => {
                if (isCompleted) return "completed" as const;
                if (isLocked) return "locked" as const;
                if (isProcessing) return "processing" as const;
                if (isSubstepReady) return "substep" as const;
                if (isQuestioning) return "questioning" as const;
                return "available" as const;
              })()}
              tone={(() => {
                if (isCompleted) return "green" as const;
                if (isLocked) return "slate" as const;
                if (isProcessing) return "amber" as const;
                if (isSubstepReady) return "purple" as const;
                return "blue" as const;
              })()}
              // FIX 1: No pasamos artifacts al PhaseCard para fases completadas
              // porque las acciones "Ver" + "Descargar PDF" ya cubren la descarga.
              // Así evitamos el enlace duplicado en forma de chip de artefacto.
              statusLabel={isProcessing ? processingLabel : undefined}
              hasQuestions={Boolean(hasQuestions)}
              processingSince={phase.updatedAt}
              artifacts={undefined}
              lastError={phase.lastError}
              actions={(() => {
                const list: React.ReactNode[] = [];
                // Para fases CON sub-step cards, los botones "Ejecutar",
                // "Responder" y "Revisar" ya están en cada SubStepCard.
                // Solo mostramos el botón global si la fase NO tiene
                // sub-step cards definidos (ej. ANALYSIS).
                const showGlobalPrimary = !hasSubSteps;
                if (isAvailable && showGlobalPrimary) {
                  list.push(
                    <PhaseActionButton
                      key="primary"
                      projectId={projectId}
                      phaseId={phase.id}
                      phaseType={phase.type}
                      label={phase.label}
                      // Reintentar el informe (no regenerar el quiz) cuando la
                      // fase quedó AVAILABLE tras un fallo y ya hay respuestas.
                      retryReport={Boolean(phase.hasAnswers && phase.lastError)}
                    />
                  );
                }
                // Cancel a la izquierda (secundaria)
                if (hasQuestions || isProcessing || isSubstepReady) {
                  list.push(
                    <button
                      key="cancel"
                      onClick={() => handleCancelPhase(phase.id)}
                      className={btnStyles.cancel}
                      title="Cancelar y volver a disponible"
                    >
                      <XCircle className="size-4" />
                      Cancelar
                    </button>
                  );
                }
                // Primaria a la derecha
                if (hasQuestions && showGlobalPrimary) {
                  list.push(
                    <button
                      key="primary"
                      onClick={() => setModalPhase(phase)}
                      className={btnStyles.primary}
                    >
                      <HelpCircle className="size-4" />
                      Responder
                    </button>
                  );
                }
                if (isSubstepReady && showGlobalPrimary) {
                  list.push(
                    <button
                      key="primary"
                      onClick={() =>
                        setSubstepModalPhase({ ...phase, subStepArtifact })
                      }
                      className={btnStyles.primary}
                    >
                      <Sparkles className="size-4" />
                      {reviewLabel}
                    </button>
                  );
                }
                // Fase COMPLETADA: solo el botón "Ver" en la tarjeta (Descargar y
                // Rehacer van al menú kebab). En IDENTITY no hay acción a nivel
                // fase: cada sub-fase tiene su propio Ver/Descargar/Rehacer.
                if (isCompleted && hasArtifacts && phase.type !== "IDENTITY") {
                  list.push(
                    <button
                      key="view"
                      onClick={() =>
                        setSubpage({
                          kind: "markdown",
                          title: phase.label,
                          url: `/api/projects/${projectId}/phases/${phase.id}/content`,
                          downloads: [
                            {
                              label: PHASE4_DOWNLOAD_LABEL,
                              href: `/api/projects/${projectId}/phases/${phase.id}/download`,
                            },
                          ],
                        })
                      }
                      className={btnStyles.secondary}
                    >
                      <Eye className="size-4" />
                      {PHASE4_VIEW_LABEL}
                    </button>
                  );
                }
                return <>{list}</>;
              })()}
              menu={(() => {
                // Kebab (Descargar / Rehacer) a la derecha del badge. En IDENTITY
                // no aparece a nivel fase (va en cada sub-fase).
                if (!(isCompleted && hasArtifacts) || phase.type === "IDENTITY") {
                  return undefined;
                }
                const items: KebabItem[] = [
                  {
                    label: PHASE4_DOWNLOAD_LABEL,
                    icon: <Download className="size-3.5" />,
                    onClick: () =>
                      triggerDownload(`/api/projects/${projectId}/phases/${phase.id}/download`),
                  },
                  {
                    label: "Rehacer esta fase",
                    icon: <RotateCcw className="size-3.5" />,
                    danger: true,
                    onClick: () => {
                      setRollbackError(null);
                      setRollbackPhase(phase);
                    },
                  },
                ];
                return <KebabMenu items={items} />;
              })()}
            />
            </div>
          );
        })}
      </div>



      {/* Questions modal */}

      {/* Questions modal */}
      {modalPhase && (
        <PhaseQuestionsModal
          open={!!modalPhase}
          onClose={() => setModalPhase(null)}
          projectId={projectId}
          phaseId={modalPhase.id}
          phaseType={modalPhase.type}
          questions={(modalPhase.questions as Array<{ id: string; label: string; type: string }>) || []}
        />
      )}

      {/* Sub-step modal (SUBSTEP_READY state) */}
      {substepModalPhase && (
        <PhaseSubstepModal
          open={!!substepModalPhase}
          onClose={() => setSubstepModalPhase(null)}
          projectId={projectId}
          phaseId={substepModalPhase.id}
          phaseType={substepModalPhase.type}
          subStep={substepModalPhase.subStep || "naming"}
          subStepArtifact={substepModalPhase.subStepArtifact}
          subStepChoice={substepModalPhase.subStepChoice}
          currentName={projectName}
          onResolved={() => {
            // When the user confirms / iterates, the parent (page.tsx) will
            // pick up the new PROCESSING status on the next router.refresh.
            // We also clear the modal here so the polling effect kicks in
            // and we don't keep the modal open on top of a stale phase.
            setSubstepModalPhase(null);
          }}
        />
      )}

      {/* Memory edit modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 shrink-0">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Edit3 className="size-4 text-amber-400" />
                Editar decisiones
              </h3>
              <button
                onClick={() => setShowMemoryModal(false)}
                disabled={savingMemory}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
              <p className="text-xs text-slate-400">
                Las decisiones que establezcas aquí tendrán prioridad sobre las decisiones automáticas de las fases.
              </p>

              {(Object.keys(memoryKeyLabels) as string[]).map((key) => (
                <div key={key} className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300 capitalize">
                    {memoryKeyLabels[key] ?? key}
                    {localMemory?.[key] && localMemory[key]!.source !== "user" && (
                      <span className="ml-1.5 text-slate-500 font-normal">
                        — definido por Fase {localMemory[key]!.source}
                      </span>
                    )}
                    {localMemory?.[key] && localMemory[key]!.source === "user" && (
                      <span className="ml-1.5 text-amber-400 font-normal">
                        — definido por usuario
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={editFields[key] ?? ""}
                    onChange={(e) =>
                      setEditFields((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={localMemory?.[key] ? formatMemoryValue(localMemory[key]!.value) : `Sin definir`}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>

            <div className="shrink-0 border-t border-slate-800 px-5 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowMemoryModal(false)}
                disabled={savingMemory}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMemory}
                disabled={savingMemory}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingMemory ? (
                  <>
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback (Regresión en cascada) — modal de confirmación.
          Avisa claramente de que se borrarán TODAS las fases posteriores. */}
      {rollbackPhase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="size-4 text-red-400" />
                Rehacer esta fase
              </h3>
              <button
                onClick={() => {
                  if (rollbackInFlight) return;
                  setRollbackPhase(null);
                }}
                disabled={rollbackInFlight}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-slate-300">
                Vas a rehacer la fase{" "}
                <span className="font-semibold text-white">{rollbackPhase.label}</span>.
              </p>
              <p className="text-sm text-red-300">
                Se borrarán de forma permanente los resultados, informes y
                estados de <span className="font-semibold">todas las fases posteriores</span>.
                Esta fase volverá a estar disponible para rehacerla desde cero.
                Esta acción no se puede deshacer.
              </p>
              {rollbackError && (
                <p className="text-sm text-red-400">{rollbackError}</p>
              )}
            </div>

            <div className="border-t border-slate-800 px-5 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  if (rollbackInFlight) return;
                  setRollbackPhase(null);
                }}
                disabled={rollbackInFlight}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRollback(rollbackPhase)}
                disabled={rollbackInFlight}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rollbackInFlight ? (
                  <>
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Rehaciendo...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Sí, rehacer y borrar posteriores
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de Rehacer un sub-paso (cascada). */}
      {substepRollback && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <RotateCcw className="size-4 text-red-400" />
                Rehacer sub-paso
              </h3>
            </div>
            <div className="px-5 py-5 space-y-3">
              <p className="text-sm text-slate-300 leading-relaxed">
                Vas a rehacer{" "}
                <span className="font-semibold text-white">{substepRollback.label}</span>. Se
                borrarán este sub-paso y los posteriores, además de las fases siguientes que
                dependían de la identidad. El hand-off se invalidará.
              </p>
              {rollbackError && <p className="text-sm text-red-400">{rollbackError}</p>}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => {
                    if (rollbackInFlight) return;
                    setSubstepRollback(null);
                    setRollbackError(null);
                  }}
                  disabled={rollbackInFlight}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubstepRollback}
                  disabled={rollbackInFlight}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
                >
                  {rollbackInFlight ? (
                    <>
                      <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Rehaciendo...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-4" />
                      Sí, rehacer este paso
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
