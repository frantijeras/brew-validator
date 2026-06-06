"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { PhaseActionButton } from "./phase-action-button";
import { PhaseQuestionsModal } from "./phase-questions-modal";
import { PhaseSubstepModal, type SubStepArtifact } from "./phase-substep-modal";

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
  subStepArtifact: { type?: "html" | "markdown"; content?: string; options?: Array<{ value: string; label: string }> } | null;
  subStepChoice: string | null;
}

interface ProjectPhasesWithModalProps {
  projectId: string;
  ideaId: string;
  projectName: string;
  phases: PhaseData[];
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
 * Human label for the download button on a COMPLETED phase, keyed by PhaseType.
 * Falls back to "Descargar" if a phase type is somehow missing.
 */
const phaseDownloadLabels: Record<string, string> = {
  ANALYSIS: "Descargar análisis",
  IDENTITY: "Descargar brand book",
  CONTENT: "Descargar estrategia",
  DEVELOPMENT: "Descargar skill técnica",
  DOSSIER: "Descargar dossier",
  BUSINESS: "Descargar plan de negocio",
  EXECUTION: "Descargar dossier",
};

/**
 * Human label for the "Revisar" button shown when a phase is in
 * SUBSTEP_READY. The label depends on the kind of sub-step, not the phase
 * type — e.g. branding's "naming" sub-step shows "Revisar nombres", while
 * dev's "compare" sub-step shows "Revisar comparativa".
 */
const subStepReviewLabels: Record<string, string> = {
  naming: "Revisar nombres",
  mockup: "Revisar mockup",
  compare: "Revisar comparativa",
  simulate: "Revisar simulación",
  pilars: "Revisar pilares",
  final: "Revisar resultado",
};

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
  download:
    "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-slate-700/60 hover:border-slate-600",
  downloadDisabled:
    "inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm font-medium text-slate-600",
  cancel:
    "inline-flex w-full items-center justify-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300",
  status: {
    processing:
      "inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400",
    completed:
      "inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400",
    locked:
      "inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-500",
  },
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
const actionsWrapper =
  "grid grid-cols-2 gap-2 sm:flex sm:w-1/2 sm:ml-auto sm:gap-2";

/** Columna derecha del wrapper de acciones. Ocupa el 50% del wrapper.
 *  El hijo dentro se estira a w-full para llenar el slot. */
const rightCol = "sm:flex-1";

/** Columna izquierda del wrapper de acciones. Ocupa el 50% del wrapper. */
const leftCol = "sm:flex-1";

/** Wrapper simplificado para pills de solo lectura (Bloqueado, Completado-sin-artefactos).
 *  Solo alinea a la derecha, sin ocupar 50%. */
const rightColSimple = "flex flex-col items-end gap-2";

export function ProjectPhasesWithModal({
  projectId,
  ideaId,
  projectName,
  phases,
}: ProjectPhasesWithModalProps) {
  const [modalPhase, setModalPhase] = useState<PhaseData | null>(null);
  const [substepModalPhase, setSubstepModalPhase] = useState<PhaseData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

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

  return (
    <>
      {/* Fase 0 — Validación de Idea (read-only view, NOT a ProjectPhase).
          Botón "Ver detalles" a la IZQUIERDA con estilo secundario (no primary),
          ya que es una acción de lectura, no de ejecución. */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5 transition-all hover:border-slate-600 hover:bg-slate-900/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0 text-amber-400">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-white">Validación de Idea</h3>
              <p className="mt-1 text-sm text-slate-400">
                Datos originales de la validación: problema, propuesta de valor, target, veredicto y reporte del juez
              </p>
            </div>
          </div>
          <div className={actionsWrapper}>
            <div className={leftCol}>
              <a
                href={`/ideas/${ideaId}?readonly=true&projectId=${projectId}`}
                className={`${btnStyles.download} shadow`}
              >
                <Eye className="size-4" />
                Ver detalles
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {phases.map((phase) => {
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

          const downloadLabel = phaseDownloadLabels[phase.type] || "Descargar";
          const reviewLabel =
            (phase.subStep && subStepReviewLabels[phase.subStep]) || "Revisar sub-paso";

          return (
            <div
              key={phase.id}
              className={`rounded-xl border p-5 transition-all ${
                isLocked
                  ? "border-slate-800 bg-slate-900/30 opacity-50"
                  : isCompleted
                    ? "border-green-500/20 bg-green-950/10"
                    : isProcessing
                      ? "border-amber-500/20 bg-amber-950/10"
                      : isSubstepReady
                        ? "border-purple-500/20 bg-purple-950/10"
                        : `${phaseBgColors[phase.type] || "bg-slate-900/50"} border-slate-700 hover:border-slate-600`
              }`}
            >
              {/* Layout: vertical en móvil (contenido arriba, botones abajo en grid 2 cols),
                  horizontal en desktop (sm:flex-row con la cabecera a la izquierda y los
                  botones a la derecha). */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                {/* Cabecera de la fase */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 shrink-0 ${
                      isCompleted
                        ? "text-green-400"
                        : isLocked
                          ? "text-slate-600"
                          : isProcessing
                            ? "text-amber-400"
                            : isSubstepReady
                              ? "text-purple-400"
                              : phaseColors[phase.type] || "text-slate-400"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="size-5" />
                    ) : isLocked ? (
                      <Lock className="size-5" />
                    ) : isProcessing ? (
                      <RefreshCw className="size-5 animate-spin" />
                    ) : isSubstepReady ? (
                      <Sparkles className="size-5" />
                    ) : hasQuestions ? (
                      <HelpCircle className="size-5" />
                    ) : (
                      phaseIcons[phase.type] || <Brain className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3
                      className={`text-base font-semibold ${
                        isCompleted
                          ? "text-green-300"
                          : isLocked
                            ? "text-slate-500"
                            : "text-white"
                      }`}
                    >
                      {phase.label}
                    </h3>
                    {phase.description && (
                      <p
                        className={`mt-1 text-sm ${
                          isLocked ? "text-slate-600" : "text-slate-400"
                        }`}
                      >
                        {phase.description}
                      </p>
                    )}

                    {/* Artefactos generados */}
                    {artifacts && artifacts.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {artifacts.map((a, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300"
                          >
                            <FileText className="size-3" />
                            {a.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status / Action:
                    - AVAILABLE: botón Ejecutar
                    - QUESTIONING: botón Responder + Cancelar
                    - PROCESSING: pill Procesando + Cancelar
                    - COMPLETED: pill Completado + botón Descargar
                    - LOCKED: pill Bloqueado
                    En móvil, los botones van en grid de 2 columnas.
                    En desktop, van en fila (sm:flex-row) o apilados verticalmente. */}
                {isAvailable && (
                  <div className={actionsWrapper}>
                    <div className={rightCol}>
                      <PhaseActionButton
                        projectId={projectId}
                        phaseId={phase.id}
                        phaseType={phase.type}
                        label={phase.label}
                      />
                    </div>
                  </div>
                )}
                {hasQuestions && (
                  <div className={actionsWrapper}>
                    <div className={leftCol}>
                      <button
                        onClick={() => handleCancelPhase(phase.id)}
                        className={btnStyles.cancel}
                        title="Cancelar y volver a disponible"
                      >
                        <XCircle className="size-3" />
                        Cancelar
                      </button>
                    </div>
                    <div className={rightCol}>
                      <button
                        onClick={() => setModalPhase(phase)}
                        className={btnStyles.primary}
                      >
                        <HelpCircle className="size-4" />
                        Responder
                      </button>
                    </div>
                  </div>
                )}
                {isProcessing && (
                  <div className={actionsWrapper}>
                    <div className={leftCol}>
                      <button
                        onClick={() => handleCancelPhase(phase.id)}
                        className={btnStyles.cancel}
                        title="Cancelar y volver a disponible"
                      >
                        <XCircle className="size-3" />
                        Cancelar
                      </button>
                    </div>
                    <div className={rightCol}>
                      <span className={btnStyles.status.processing}>
                        <RefreshCw className="size-3 animate-spin" />
                        Procesando
                      </span>
                    </div>
                  </div>
                )}
                {isSubstepReady && (
                  <div className={actionsWrapper}>
                    <div className={leftCol}>
                      <button
                        onClick={() => handleCancelPhase(phase.id)}
                        className={btnStyles.cancel}
                        title="Cancelar y volver a disponible"
                      >
                        <XCircle className="size-3" />
                        Cancelar
                      </button>
                    </div>
                    <div className={rightCol}>
                      <button
                        onClick={() =>
                          setSubstepModalPhase({ ...phase, subStepArtifact })
                        }
                        className={btnStyles.primary}
                      >
                        <Sparkles className="size-4" />
                        {reviewLabel}
                      </button>
                    </div>
                  </div>
                )}
                {isCompleted && (
                  <div className={hasArtifacts ? actionsWrapper : rightColSimple}>
                    {hasArtifacts ? (
                      <>
                        <div className={leftCol}>
                          <span className={btnStyles.status.completed}>
                            <CheckCircle className="size-3" />
                            Completado
                          </span>
                        </div>
                        <div className={rightCol}>
                          <a
                            href={`/api/projects/${projectId}/phases/${phase.id}/download`}
                            className={btnStyles.download}
                            download
                          >
                            <Download className="size-4" />
                            {downloadLabel}
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className={rightCol}>
                        <span className={btnStyles.status.completed}>
                          <CheckCircle className="size-3" />
                          Completado
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {isLocked && (
                  <div className={rightColSimple}>
                    <span className={btnStyles.status.locked}>
                      <Lock className="size-3" />
                      Bloqueado
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
      {substepModalPhase && (
        <PhaseSubstepModal
          open={!!substepModalPhase}
          onClose={() => setSubstepModalPhase(null)}
          projectId={projectId}
          phaseId={substepModalPhase.id}
          phaseType={substepModalPhase.type}
          subStep={substepModalPhase.subStep || "final"}
          subStepArtifact={substepModalPhase.subStepArtifact}
          subStepChoice={substepModalPhase.subStepChoice}
          onResolved={() => {
            // When the user confirms / iterates, the parent (page.tsx) will
            // pick up the new PROCESSING status on the next router.refresh.
            // We also clear the modal here so the polling effect kicks in
            // and we don't keep the modal open on top of a stale phase.
            setSubstepModalPhase(null);
          }}
        />
      )}
    </>
  );
}
