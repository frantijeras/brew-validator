"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Lock,
  Sparkles,
  FileText,
  Brain,
  Palette,
  TrendingUp,
  Code,
  FileDown,
  RefreshCw,
  HelpCircle,
  Trash2,
  X,
  XCircle,
  AlertTriangle,
  BriefcaseBusiness,
  Rocket,
  FileCheck,
  Download,
  Eye,
  Save,
  Info,
  Edit3,
  Package,
} from "lucide-react";
import { PhaseActionButton } from "./phase-action-button";
import { PhaseQuestionsModal } from "./phase-questions-modal";
import { PhaseSubstepModal, type SubStepArtifact } from "./phase-substep-modal";
import { PhaseCard } from "./phase-card";
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

interface PhaseData {
  id: string;
  type: string;
  label: string;
  description: string | null;
  status: string;
  sortOrder: number;
  artifacts: Array<{ title: string; type: string }> | null;
  questions: Array<{ id: string; label: string; type: string }> | null;
  subStep: string | null;
  subStepOrder: number | null;
  subStepArtifact: { type?: "html" | "markdown"; content?: string; options?: Array<{ value: string; label: string }> } | null;
  subStepChoice: string | null;
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
  DEVELOPMENT: <Code className="size-5" />,
  DOSSIER: <FileDown className="size-5" />,
  BUSINESS: <BriefcaseBusiness className="size-5" />,
  EXECUTION: <Rocket className="size-5" />,
};

const phaseColors: Record<string, string> = {
  IDENTITY: "text-purple-400 border-purple-500/30",
  ANALYSIS: "text-blue-400 border-blue-500/30",
  CONTENT: "text-amber-400 border-amber-500/30",
  DEVELOPMENT: "text-green-400 border-green-500/30",
  DOSSIER: "text-rose-400 border-rose-500/30",
  BUSINESS: "text-cyan-400 border-cyan-500/30",
  EXECUTION: "text-orange-400 border-orange-500/30",
};

const phaseBgColors: Record<string, string> = {
  IDENTITY: "bg-purple-500/10",
  ANALYSIS: "bg-blue-500/10",
  CONTENT: "bg-amber-500/10",
  DEVELOPMENT: "bg-green-500/10",
  DOSSIER: "bg-rose-500/10",
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
  visual: "Revisar mockup",
  compare: "Revisar comparativa",
  simulate: "Revisar simulación",
  pilars: "Revisar pilares",
  generate: "Revisar preguntas",
  final: "Revisar resultado",
};

const subStepExecuteLabels: Record<string, string> = {
  quiz: "Responder",
  naming: "Ejecutar",
  voice: "Ejecutar",
  visual: "Ejecutar",
  pilars: "Ejecutar",
  compare: "Ejecutar",
  simulate: "Ejecutar",
  generate: "Ejecutar",
  final: "Ejecutar",
};

const subStepProcessingMessages: Record<string, string> = {
  quiz: "Procesando respuestas...",
  naming: "Generando opciones...",
  voice: "Definiendo personalidad...",
  visual: "Generando mockup...",
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
    // Other sub-steps remain locked until quiz is answered
    if (subStepMeta.id === "quiz") return "available";
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
    "inline-flex w-full items-center justify-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300",
} as const;

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
  const [deleting, setDeleting] = useState(false);
  const [localMemory, setLocalMemory] = useState<ProjectMemory | null>(memory);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const router = useRouter();

  // Sync localMemory when parent memory changes
  useEffect(() => {
    setLocalMemory(memory);
  }, [memory]);

  const completedCount = phases.filter((p) => p.status === "COMPLETED").length;
  const showHandoffBox = completedCount >= 4;

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

  useEffect(() => {
    if (!isAnyProcessingOrQuestioning) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [isAnyProcessingOrQuestioning, router]);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  async function handleDelete() {
    if (deleteConfirm.trim() !== projectName) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/projects/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al borrar");
      }
      router.push("/proyectos");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error al borrar");
      setDeleting(false);
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
      {/* Contenedor de TODAS las tarjetas de fase (Fase 0 + fases del proyecto).
          El `space-y-3` aplica el mismo gap entre CUALQUIER par de tarjetas
          consecutivas, incluida la pareja Fase 0 → Fase 1. Antes la Fase 0
          estaba fuera de este contenedor y por eso se pegaba a la Fase 1. */}
      <div className="space-y-3">
        {/* Fase 00 — Validación de Idea (heredada de la fase de ideas).
            Siempre se muestra como completada porque la validación ya se
            realizó en la fase de ideas.

            Phase 4 refactor: en lugar del antiguo "Ver detalles" que
            abría la página de la idea en modo read-only (con UI
            sobrecargada de elementos de edición), ahora seguimos el
            mismo patrón simétrico que las fases reales del proyecto:
              - "Ver" → abre el HTML consolidado en una pestaña nueva
              - "Descargar PDF" → descarga el PDF consolidado
            Las URLs apuntan a /api/projects/[id]/validation/{view,download}. */}
        <PhaseCard
          number={0}
          title="Validación de Idea"
          description="Datos originales de la validación: problema, propuesta de valor, target, veredicto y reporte del juez"
          icon={<FileText className="size-5" />}
          status="completed"
          tone="green"
          actions={
            <>
              <Link
                href={`/proyectos/${projectId}/validacion`}
                className={`${btnStyles.secondary} shadow`}
              >
                <Eye className="size-4" />
                {PHASE4_VIEW_LABEL}
              </Link>
              <a
                href={`/api/projects/${projectId}/validation/download`}
                className={`${btnStyles.download} shadow`}
                download
              >
                <Download className="size-4" />
                {PHASE4_DOWNLOAD_LABEL}
              </a>
            </>
          }
        />

        {/* 📌 Memory banner — decisiones vigentes */}
        {memoryEntries.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
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
              const executeLabel = meta.id === "quiz" && isQuestioning ? "Responder" : (subStepExecuteLabels[meta.id] || "Ejecutar");
              const reviewLabel = subStepReviewLabels[meta.id] || "Revisar";
              const processingMsg = subStepProcessingMessages[meta.id] || "Generando...";

              // Determinar onAction según el estado y tipo de sub-step
              let onAction: (() => void) | undefined;
              if (sStatus === "available") {
                // Si el sub-step actual tiene preguntas activas, abrir modal
                if ((hasQuestions || (isQuestioning && meta.id === "quiz")) && meta.id === "quiz") {
                  onAction = () => setModalPhase(phase);
                } else if (meta.order === 0) {
                  // Solo el primer sub-step disponible ejecuta la fase
                  onAction = () => {
                    fetch("/api/projects/execute-phase", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        projectId,
                        phaseId: phase.id,
                        phaseType: phase.type,
                      }),
                    })
                      .then((res) => {
                        if (res.ok) router.refresh();
                      })
                      .catch(() => {});
                  };
                }
              } else if (sStatus === "substep_ready") {
                onAction = () =>
                  setSubstepModalPhase({ ...phase, subStepArtifact });
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
                />
              );
            });
          }

          return (
            <PhaseCard
              key={phase.id}
              number={phase.sortOrder}
              title={phase.label}
              description={phase.description ?? undefined}
              subSteps={subStepCards}
              icon={(() => {
                if (isCompleted) return <CheckCircle className="size-5" />;
                if (isLocked) return <Lock className="size-5" />;
                if (isProcessing) return <RefreshCw className="size-5 animate-spin" />;
                if (isSubstepReady) return <Sparkles className="size-5" />;
                if (hasQuestions) return <HelpCircle className="size-5" />;
                return phaseIcons[phase.type] || <Brain className="size-5" />;
              })()}
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
              artifacts={undefined}
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
                    />
                  );
                }
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
                // Cancel siempre se muestra (incluso con sub-step cards)
                if (hasQuestions || isProcessing || isSubstepReady) {
                  list.push(
                    <button
                      key="cancel"
                      onClick={() => handleCancelPhase(phase.id)}
                      className={btnStyles.cancel}
                      title="Cancelar y volver a disponible"
                    >
                      <XCircle className="size-3" />
                      Cancelar
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
                if (isCompleted && hasArtifacts) {
                  // Phase 4: symmetric "Ver" + "Descargar PDF" buttons.
                  // The HTML view is opened in a new tab; the PDF triggers
                  // a download. Both labels are consistent across all phases.
                  list.push(
                    <Link
                      key="view"
                      href={`/proyectos/${projectId}/fase/${phase.id}`}
                      className={btnStyles.secondary}
                    >
                      <Eye className="size-4" />
                      {PHASE4_VIEW_LABEL}
                    </Link>
                  );
                  list.push(
                    <a
                      key="download"
                      href={`/api/projects/${projectId}/phases/${phase.id}/download`}
                      className={btnStyles.download}
                      download
                    >
                      <Download className="size-4" />
                      {PHASE4_DOWNLOAD_LABEL}
                    </a>
                  );
                }
                return <>{list}</>;
              })()}
            />
          );
        })}
      </div>

      {/* 🎯 Handoff Package — shown when ≥4 phases completed */}
      {showHandoffBox && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-6 mt-6">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <Package className="size-6 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white">
                🎯 Proyecto completado
              </h3>
              <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                Descarga el <strong className="text-emerald-300">Handoff Package</strong> con todo el proyecto organizado más skills ejecutables listas para usar con Cline, Cursor o Copilot.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`/api/projects/${projectId}/handoff`}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-400 active:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                  download
                >
                  <Package className="size-4" />
                  Descargar Handoff ZIP
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete project section */}
      <div className="border-t border-slate-800 pt-6 mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-red-400">Zona peligrosa</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Esta acción no se puede deshacer
            </p>
          </div>
          <button
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirm("");
              setDeleteError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-950/40 hover:border-red-500/50"
          >
            <Trash2 className="size-4" />
            Borrar proyecto
          </button>
        </div>
      </div>

      {/* Delete confirm modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/20 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                Borrar proyecto
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Esto eliminará el proyecto y todas sus fases de forma permanente.
                <span className="block mt-1 text-slate-400">La idea original no se verá afectada.</span>
              </p>
              <p className="text-sm text-slate-400">
                Escribe <strong className="text-red-400">{projectName}</strong> para confirmar:
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={projectName}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              {deleteError && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertTriangle className="size-3" />
                  {deleteError}
                </span>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirm !== projectName}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Borrando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      Borrar proyecto
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
      {substepModalPhase && (() => {
        // For IDENTITY "final" sub-step, extract artifacts from sibling
        // sub-step states of the same phase. The IDENTITY phase is a single
        // DB row that mutates through sub-steps, so when we're on "final",
        // the current row's subStepArtifact/content may still contain the
        // visual artifact JSON, while naming/voice content is in the
        // subStepChoice field.
        const identityPhase =
          substepModalPhase.type === "IDENTITY"
            ? phases.find((p) => p.type === "IDENTITY")
            : null;
        
        // Naming: the chosen name is in subStepChoice; the actual artifact
        // content (options + rationale) might already be gone by the time
        // we reach `final`. We pass the choice as fallback.
        const namingContent =
          identityPhase?.subStep === "naming"
            ? identityPhase.subStepArtifact?.content ?? null
            : identityPhase?.subStepChoice
              ? `**Nombre elegido:** ${identityPhase.subStepChoice}\n\nEl nombre fue seleccionado en la sub-fase de naming.`
              : null;
        
        // Voice: if we're on voice sub-step, the artifact is current;
        // otherwise it may be lost.
        const voiceContent =
          identityPhase?.subStep === "voice"
            ? identityPhase.subStepArtifact?.content ?? null
            : null;
        
        // Visual: if we're on visual, use the current artifact; if on final,
        // the visual artifact JSON might still be in subStepArtifact.content.
        const visualJson =
          identityPhase?.subStepArtifact?.content ?? null;
        
        // Visual choice: the variant the user picked (A/B/C).
        const chosenVariant =
          identityPhase?.subStepChoice &&
          ["A", "B", "C"].includes(identityPhase.subStepChoice)
            ? identityPhase.subStepChoice
            : null;

        return (
          <PhaseSubstepModal
            open={!!substepModalPhase}
            onClose={() => setSubstepModalPhase(null)}
            projectId={projectId}
            phaseId={substepModalPhase.id}
            phaseType={substepModalPhase.type}
            subStep={substepModalPhase.subStep || "final"}
            subStepArtifact={substepModalPhase.subStepArtifact}
            subStepChoice={substepModalPhase.subStepChoice}
            currentName={projectName}
            namingArtifactContent={namingContent}
            voiceArtifactContent={voiceContent}
            visualArtifactJson={visualJson}
            visualChoice={chosenVariant}
            projectDescription={null}
            onResolved={() => {
              // When the user confirms / iterates, the parent (page.tsx) will
              // pick up the new PROCESSING status on the next router.refresh.
              // We also clear the modal here so the polling effect kicks in
              // and we don't keep the modal open on top of a stale phase.
              setSubstepModalPhase(null);
            }}
          />
        );
      })()}

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

            <div className="shrink-0 border-t border-slate-800 px-5 py-4 flex items-center gap-3">
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
              <button
                onClick={() => setShowMemoryModal(false)}
                disabled={savingMemory}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
