"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Archive, Trash2, Undo2, MoreHorizontal, Pencil, FileDown, Save, X, AlertCircle, FolderKanban, Sparkles } from "lucide-react";
import { ValidationProgress } from "@/components/validation-progress";
import { ReportViewer } from "@/components/report-viewer";
import { ConfirmModal } from "@/components/confirm-modal";
import { getScoreColor, STATUS_LABELS, STATUS_COLORS } from "@/lib/translations";
import { BUSINESS_MODELS } from "@/lib/business-models";
import { BusinessModelIcon } from "@/components/business-model-icon";
import { generatePdf } from "@/lib/pdf-export";
import { TextExpander } from "@/components/text-expander";
import { ClampText } from "@/components/clamp-text";
import { useBridgeStatus } from "@/hooks/use-bridge-status";
import { isIdeaBusy } from "@/lib/idea-state";
import { Button } from "@/components/ui/button";
import { DemoLimitDialog } from "@/components/demo-limit-dialog";
import { RefineIdeaPanel, type FieldKey } from "./refine-idea-panel";
import { ImproveIdeaPanel } from "./improve-idea-panel";

interface IdeaData {
  id: string;
  title: string;
  description: string;
  problem: string | null;
  valueProposition: string | null;
  originalIdea: string | null;
  targetUser: string;
  monetization: string;
  status: string;
  validationStatus: string;
  verdict: string | null;
  score: number | null;
  businessModel: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  reports: ReportData[];
  failureReason: string | null;
}

interface ReportData {
  id: string;
  agentName: string;
  title: string;
  content: string;
  verdict: string | null;
  scorecard: string | null;
  createdAt: string;
}

export default function IdeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ideaId = params.id as string;
  const readonly = searchParams.get("readonly") === "true";
  const projectId = searchParams.get("projectId");

  const [idea, setIdea] = useState<IdeaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [apiError, setApiError] = useState("");
  const [archPending, setArchPending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // Refinado de idea (flujo inline, sin modal) — ahora dirigido por estado.
  // El servidor aplica los cambios; la página detecta status === "REFINING",
  // muestra el spinner y sondea la idea hasta que el estado cambia.
  const [refinePanelOpen, setRefinePanelOpen] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [refineSuccess, setRefineSuccess] = useState(false);
  const [refineLimit, setRefineLimit] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<Record<string, string> | null>(null);
  // Mejorar idea (quiz según el veredicto). El panel gestiona preguntas/apply;
  // tras el apply la idea entra en status === "IMPROVING" (mismo mecanismo).
  const [improvePanelOpen, setImprovePanelOpen] = useState(false);
  const [improveSuccess, setImproveSuccess] = useState(false);
  const [improveLimit, setImproveLimit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancellingValidation, setCancellingValidation] = useState(false);
  const [showCancelValidationConfirm, setShowCancelValidationConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProblem, setEditProblem] = useState("");
  const [editValueProposition, setEditValueProposition] = useState("");
  const [editTargetUser, setEditTargetUser] = useState("");
  const [editMonetization, setEditMonetization] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Bridge status — used to block AI actions when the bridge is down
  const { status: bridgeStatus } = useBridgeStatus();
  const bridgeDown = bridgeStatus !== null && !bridgeStatus.reachable;

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const fetchIdea = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/ideas");
          return;
        }
        throw new Error("Error al cargar la idea");
      }
      const data = await res.json();
      setIdea(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [ideaId, router]);

  // Initial load
  useEffect(() => {
    fetchIdea();
  }, [fetchIdea]);

  // Estados dirigidos por el servidor: la idea está siendo refinada/mejorada por
  // el bridge. El servidor aplica los cambios y resetea el estado al terminar.
  const busyRefine = idea?.status === "REFINING";
  const busyImprove = idea?.status === "IMPROVING";

  // Polling when validating, when idea generation is in progress, or while el
  // servidor está refinando/mejorando la idea (sondeo rápido para reaccionar
  // en cuanto el estado cambie).
  const shouldPoll =
    idea?.validationStatus === "RUNNING" ||
    (idea?.status === "DRAFT" && idea?.validationStatus === "PENDING");
  const shouldPollFast = busyRefine || busyImprove;

  useEffect(() => {
    if (shouldPollFast) {
      pollRef.current = setInterval(fetchIdea, 2000);
    } else if (shouldPoll) {
      pollRef.current = setInterval(fetchIdea, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [shouldPoll, shouldPollFast, fetchIdea]);

  // Detecta la transición de salida de REFINING/IMPROVING para mostrar el aviso
  // de éxito correspondiente (funciona también si la página se montó ya en uno
  // de esos estados y luego termina).
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = idea?.status ?? null;
    if (prev === "REFINING" && curr !== "REFINING") {
      setRefineSuccess(true);
      setRefinePanelOpen(false);
      setRefineError(null);
    }
    if (prev === "IMPROVING" && curr !== "IMPROVING") {
      setImproveSuccess(true);
      setImprovePanelOpen(false);
    }
    prevStatusRef.current = curr;
  }, [idea?.status]);

  const isCompleted = idea?.status === "COMPLETED" || idea?.validationStatus === "DONE";

  async function handleValidate() {
    if (bridgeDown) {
      setApiError(
        "El servicio de IA no está disponible. El servidor local puede estar apagado. Inténtalo más tarde."
      );
      return;
    }
    setValidating(true);
    setApiError("");
    try {
      const res = await fetch(`/api/ideas/${ideaId}/validate`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al iniciar la validación");
      }
      await fetchIdea();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error");
    } finally {
      setValidating(false);
    }
  }

  async function handleRegenerate() {
    if (!idea) return;
    if (bridgeDown) {
      setApiError(
        "El servicio de IA no está disponible. El servidor local puede estar apagado. Inténtalo más tarde."
      );
      return;
    }
    setRegenerating(true);
    setApiError("");
    try {
      // Re-run generation reusing the idea's stored inputs. A custom idea keeps
      // the user's raw text (originalIdea); otherwise we fall back to a random
      // generation. The generate endpoint creates a brand-new idea, so once it
      // succeeds we delete the failed one and navigate to the new idea.
      const body = idea.originalIdea
        ? {
            mode: "custom" as const,
            rawIdea: idea.originalIdea,
            businessModel: idea.businessModel || undefined,
          }
        : {
            mode: "random" as const,
            businessModel: idea.businessModel || undefined,
          };
      const res = await fetch(`/api/ideas/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al reintentar la generación");
      }
      const data = await res.json();
      // Best-effort cleanup of the failed idea (don't block navigation on it).
      await fetch(`/api/ideas/${ideaId}`, {
        method: "DELETE",
        credentials: "same-origin",
      }).catch(() => {});
      router.push(`/ideas/${data.ideaId}`);
      router.refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error");
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar");
      }
      router.push("/ideas");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  async function handleExportPdf() {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/export`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Error al obtener datos para el PDF");
      const data = await res.json();
      const filename = `${data.title.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/g, "_").slice(0, 60)}-informe.pdf`;
      generatePdf(filename, data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al exportar PDF");
    }
  }

  async function toggleArchive() {
    if (!idea || archPending) return;
    setArchPending(true);
    const next = !idea.isArchived;
    setIdea({ ...idea, isArchived: next });
    try {
      await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isArchived: next }),
      });
    } catch {
      setIdea({ ...idea, isArchived: !next });
    } finally {
      setArchPending(false);
    }
    setShowMenu(false);
  }

  function enterEditMode() {
    if (!idea) return;
    setEditTitle(idea.title);
    setEditDescription(idea.description);
    setEditProblem(idea.problem || "");
    setEditValueProposition(idea.valueProposition || "");
    setEditTargetUser(idea.targetUser);
    setEditMonetization(idea.monetization);
    setIsEditing(true);
    setApiError("");
  }

  function cancelEdit() {
    setIsEditing(false);
    setApiError("");
  }

  async function handleSaveEdit() {
    if (!idea) return;
    if (editTitle.trim().length < 3) {
      setApiError("El título debe tener al menos 3 caracteres");
      return;
    }
    if (editDescription.trim().length < 10) {
      setApiError("La descripción debe tener al menos 10 caracteres");
      return;
    }
    setSaving(true);
    setApiError("");
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          problem: editProblem.trim() || null,
          valueProposition: editValueProposition.trim() || null,
          targetUser: editTargetUser.trim(),
          monetization: editMonetization.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }
      const updated = await res.json();
      setIdea(updated);
      setIsEditing(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelValidation() {
    setShowCancelValidationConfirm(false);
    setCancellingValidation(true);
    setApiError("");
    try {
      const res = await fetch(`/api/ideas/${ideaId}/validate/cancel`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al cancelar la validación");
      }
      await fetchIdea();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al cancelar la validación");
    } finally {
      setCancellingValidation(false);
    }
  }

  // ── Refinado de idea (dirigido por estado) ────────────────────────────────
  //
  // Ya NO se sondea el job ni se aplican los cambios en el cliente. El servidor
  // aplica los campos y resetea el estado al terminar. Aquí solo lanzamos el
  // POST: tras el éxito la idea queda en status === "REFINING", lo que hace que
  // la página muestre el spinner y sondee la idea (ver shouldPollFast). Esto
  // sobrevive a recargas y navegación: al volver con status REFINING, el spinner
  // y el sondeo se reactivan solos.
  async function handleStartRefine(fields: FieldKey[], instruction: string) {
    if (!idea) return;
    setRefineError(null);
    setRefineSuccess(false);
    // Captura best-effort de los valores actuales para poder deshacer mientras
    // sigamos en pantalla (no disponible tras recargar, y no pasa nada).
    const snapshot: Record<string, string> = {};
    for (const key of fields) {
      snapshot[key] = (idea[key as keyof IdeaData] ?? "").toString();
    }
    try {
      const res = await fetch(`/api/ideas/${ideaId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ fields, instruction }),
      });
      if (res.status === 403) {
        setRefineLimit(true);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo iniciar el refinado");
      }
      const data = await res.json();
      if (!data?.jobId) throw new Error("Respuesta inesperada del servidor");
      // No sondeamos el job: el servidor pone la idea en REFINING y aplica los
      // cambios. Guardamos el snapshot para el "Deshacer" y refrescamos para
      // recoger cuanto antes el nuevo estado (que dispara el spinner).
      setUndoSnapshot(snapshot);
      setRefinePanelOpen(false);
      await fetchIdea();
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Error al refinar");
    }
  }

  // Deshace el último refinado restaurando los valores previos.
  async function handleUndoRefine() {
    if (!undoSnapshot) return;
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(undoSnapshot),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo deshacer el refinado");
      }
      setUndoSnapshot(null);
      setRefineSuccess(false);
      await fetchIdea();
      router.refresh();
    } catch (err) {
      setRefineError(
        err instanceof Error ? err.message : "Error al deshacer el refinado"
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner large />
      </div>
    );
  }

  if (error || !idea) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-400">{error || "Idea no encontrada"}</p>
        <Link
          href="/ideas"
          className="mt-4 inline-block text-sm text-amber-400 hover:text-amber-300"
        >
          ← Volver a ideas
        </Link>
      </div>
    );
  }

  // Bloquea acciones de mutación de contenido (validar, exportar, etc.)
  // mientras la idea está siendo procesada por el bridge. Incluimos también
  // IMPROVING aquí explícitamente (refine/improve dirigidos por estado).
  const isBusy = isIdeaBusy(idea.status) || busyRefine || busyImprove;
  const isDraft = idea.status === "DRAFT";

  // Distinguish a GENERATION failure from a VALIDATION failure.
  //
  // Robust signal from the callback (see agent-callback/route.ts):
  //  - idea-generator failure → status="FAILED"   (idea never produced content)
  //  - validation-agent failure → status="COMPLETED", validationStatus="FAILED"
  //    (the idea already had real content from a prior generation)
  //
  // So status==="FAILED" + no reports means the idea was never generated. We
  // also confirm it never reached DRAFT (placeholder content still in place)
  // for custom ideas where the title is the user's raw text. The dominant
  // signal is status==="FAILED" with no reports.
  const isGenerationFailure =
    idea.status === "FAILED" && idea.reports.length === 0;
  const isValidationFailure =
    idea.validationStatus === "FAILED" && !isGenerationFailure;

  // No tiene sentido ofrecer "Validar" cuando la idea ni siquiera se generó.
  const canValidate =
    !isBusy &&
    !isGenerationFailure &&
    idea.validationStatus !== "RUNNING" &&
    idea.validationStatus !== "DONE";

  // "Refinar idea" — solo ANTES de validar: la idea ya está generada (no es un
  // fallo de generación), no está ocupada y aún no se ha validado ni se está
  // validando. Oculta en readonly (no es el autor en su vista normal).
  const canRefine =
    !readonly &&
    !isBusy &&
    !isGenerationFailure &&
    idea.validationStatus !== "RUNNING" &&
    idea.validationStatus !== "DONE";

  // "Mejorar idea según el veredicto" — solo DESPUÉS de validar: la idea está
  // validada (DONE), no está ocupada y no es la vista readonly.
  const canImprove =
    !readonly && !isBusy && idea.validationStatus === "DONE";

  const formattedCreated = new Date(idea.createdAt).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedUpdated = new Date(idea.updatedAt).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      {/* Back link */}
      {readonly && projectId ? (
        <Link
          href={`/proyectos/${projectId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          <ArrowLeftIcon />
          Volver al proyecto
        </Link>
      ) : (
        <Link
          href="/ideas"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeftIcon />
          Volver a ideas
        </Link>
      )}

      {/* Header — sticky para que los botones de acción siempre sean visibles */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-6 bg-[#0B0E1E] border-b border-slate-800/60 md:-mx-0 md:px-0 md:py-0 md:mb-8 md:border-0 md:bg-transparent">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                {idea.title}
              </h1>

              {idea.isArchived && (
                <span className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium text-amber-400 bg-amber-500/10 border-amber-500/30">
                  Archivada
                </span>
              )}

              {/* 3-dot menu — hidden in readonly */}
              {!readonly && (
              <div className="relative ml-auto" ref={menuRef}>
                <button
                  onClick={() => setShowMenu((prev) => !prev)}
                  className="rounded-md p-1.5 leading-none transition-colors hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  title="Más opciones"
                  aria-label="Más opciones"
                >
                  <MoreHorizontal className="size-5" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-lg border border-slate-700 bg-slate-800 shadow-xl py-1.5">
                    {/* Archive / Unarchive */}
                    {!readonly && (
                      idea.isArchived ? (
                        <button
                          onClick={toggleArchive}
                          disabled={archPending}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          <Undo2 className="size-4 text-slate-400" />
                          Desarchivar
                        </button>
                      ) : (
                        <button
                          onClick={toggleArchive}
                          disabled={archPending}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                          <Archive
                            className={`size-4 ${idea.isArchived ? "text-amber-400" : "text-slate-400"}`}
                            fill={idea.isArchived ? "currentColor" : "none"}
                          />
                          Archivar
                        </button>
                      )
                    )}

                    {/* Edit idea original — only when DRAFT */}
                    {idea.status === "DRAFT" && (
                      <>
                        {/* Separator */}
                        <div className="my-1 border-t border-slate-700" />
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            enterEditMode();
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                        >
                          <Pencil className="size-4 text-slate-400" />
                          Editar idea original
                        </button>
                      </>
                    )}

                    {/* Separator before Delete */}
                    <div className="my-1 border-t border-slate-700" />

                    {/* Delete */}
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteModal(true);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                    >
                      <Trash2 className="size-4" />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Badges: Business type | Status | Score */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Business type badge */}
              {idea.businessModel && (() => {
                const model = BUSINESS_MODELS.find((m) => m.value === idea.businessModel);
                return model ? (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-slate-400 border-slate-700">
                    <BusinessModelIcon model={model.value} className="size-3.5" />
                    <span>{model.label}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-slate-400 border-slate-700">
                    {idea.businessModel}
                  </span>
                );
              })()}

              {/* 3. Status badge with color */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[idea.status] ?? STATUS_COLORS["DRAFT"]}`}
              >
                {(idea.status === "GENERATING" || idea.status === "VALIDATING") && (
                  <span className="size-1.5 rounded-full bg-current animate-pulse" />
                )}
                {STATUS_LABELS[idea.status] ?? idea.status}
              </span>

              {/* 4. Score */}
              {idea.score !== null && (
                <span className={`text-sm font-semibold tabular-nums ${getScoreColor(idea.score)}`}>
                  {idea.score.toFixed(1)}
                </span>
              )}
            </div>

            {/* Action buttons: Validate + Reformulate + Export + Revalidate */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {canValidate && (
                <Button
                  variant="primary"
                  onClick={handleValidate}
                  loading={validating}
                  title={
                    bridgeDown
                      ? "El servicio de IA no está disponible"
                      : undefined
                  }
                  className="gap-2 py-2.5 shadow"
                >
                  {validating ? (
                    "Iniciando…"
                  ) : (
                    <>
                      <ZapIcon />
                      {isDraft ? "Validar esta idea" : "Validar con IA"}
                    </>
                  )}
                </Button>
              )}
              {canRefine && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRefineError(null);
                    setRefinePanelOpen((prev) => !prev);
                  }}
                  className="gap-2 py-2.5 shadow"
                >
                  <Sparkles className="size-4" />
                  Refinar idea
                </Button>
              )}
              {canImprove && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setImproveSuccess(false);
                    setImprovePanelOpen((prev) => !prev);
                  }}
                  className="gap-2 py-2.5 shadow"
                >
                  <Sparkles className="size-4" />
                  Mejorar idea según el veredicto
                </Button>
              )}
              {/* Convertir en proyecto */}
              {!readonly && (idea.status === "COMPLETED" || idea.validationStatus === "DONE") && (
                <ConvertToProjectButton ideaId={idea.id} />
              )}

              <Button
                variant="secondary"
                onClick={handleExportPdf}
                disabled={isBusy}
                title={
                  isBusy
                    ? "Espera a que termine el procesamiento actual"
                    : undefined
                }
                className="gap-2 py-2.5 shadow"
              >
                <FileDown className="size-4" />
                Descargar PDF
              </Button>
            </div>

            {apiError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{apiError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation progress — sticky at top while running, always visible on mobile */}
      {idea.validationStatus === "RUNNING" && (
        <div className="sticky top-0 z-50 mb-8">
          <ValidationProgress
            validationStatus={idea.validationStatus}
            reports={idea.reports}
            onCancel={() => setShowCancelValidationConfirm(true)}
            cancelling={cancellingValidation}
          />
        </div>
      )}

      {/* Stuck validation — bridge is down and the job is hanging */}
      {idea.validationStatus === "RUNNING" && bridgeDown && (
        <div className="mb-8 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-200">
                Validación en pausa
              </h3>
              <p className="mt-1 text-sm text-red-200/80">
                El servidor local de IA no responde, por lo que la validación
                no puede avanzar. Tus datos están guardados. Cuando el
                servicio vuelva, pulsa «Reintentar» para comprobar de nuevo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de éxito tras refinar (descartable, con opción de deshacer) */}
      {refineSuccess && !busyRefine && !busyImprove && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <span className="font-medium">Idea refinada ✓</span>
          <div className="flex items-center gap-4">
            {undoSnapshot && (
              <button
                type="button"
                onClick={handleUndoRefine}
                className="font-medium text-emerald-200 underline underline-offset-2 hover:text-white"
              >
                Deshacer
              </button>
            )}
            <button
              type="button"
              onClick={() => setRefineSuccess(false)}
              aria-label="Descartar aviso"
              className="text-emerald-200/70 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Aviso de éxito tras mejorar según el veredicto (validación reseteada) */}
      {improveSuccess && !busyRefine && !busyImprove && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <span className="font-medium">
            Idea mejorada según el veredicto. Vuelve a validarla.
          </span>
          <button
            type="button"
            onClick={() => setImproveSuccess(false)}
            aria-label="Descartar aviso"
            className="text-emerald-200/70 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Panel inline de refinado — sustituye al antiguo modal (paso formulario) */}
      {canRefine && refinePanelOpen && (
        <RefineIdeaPanel
          idea={{
            description: idea.description,
            problem: idea.problem,
            valueProposition: idea.valueProposition,
            targetUser: idea.targetUser,
            monetization: idea.monetization,
          }}
          onSubmit={handleStartRefine}
          onCancel={() => {
            setRefinePanelOpen(false);
            setRefineError(null);
          }}
          error={refineError}
        />
      )}

      {/* Panel de mejora según el veredicto (quiz). Gestiona preguntas + apply.
          Al hacer apply, la idea entra en IMPROVING y la página muestra el
          spinner correspondiente (mecanismo dirigido por estado). */}
      {canImprove && improvePanelOpen && (
        <ImproveIdeaPanel
          ideaId={ideaId}
          onApplied={() => {
            // El apply ya dejó la idea en IMPROVING server-side: refresca para
            // recoger el estado y disparar el spinner "Mejorando idea…".
            setImprovePanelOpen(false);
            void fetchIdea();
          }}
          onCancel={() => setImprovePanelOpen(false)}
          onLimit={() => {
            setImprovePanelOpen(false);
            setImproveLimit(true);
          }}
        />
      )}

      {/* Error de refinado fuera del panel (p. ej. tras un job FAILED) */}
      {refineError && !refinePanelOpen && !busyRefine && !busyImprove && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{refineError}</span>
        </div>
      )}

      {/* Spinner dirigido por estado: mientras el servidor refina o mejora la
          idea, sustituye a la tarjeta de contenido. Funciona también en carga
          en frío (si la idea ya viene en REFINING/IMPROVING) gracias al sondeo. */}
      {busyRefine || busyImprove ? (
        <div className="mb-8 flex flex-col items-center justify-center gap-4 rounded-xl border border-amber-500/30 bg-slate-900/50 px-6 py-20 text-center">
          <span className="size-10 animate-spin rounded-full border-4 border-slate-700 border-t-amber-400" />
          <p className="text-sm font-medium text-slate-300">
            {busyImprove ? "Mejorando idea…" : "Refinando idea…"}
          </p>
        </div>
      ) : (
      <>
      {/* Idea original / Edit mode */}
      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            {isEditing ? "Editando idea" : "Idea original"}
          </h2>
          {isEditing && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={cancelEdit}
              >
                <X className="size-3.5" />
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEdit}
                loading={saving}
                className="shadow"
              >
                {saving ? (
                  "Guardando…"
                ) : (
                  <>
                    <Save className="size-3.5" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Title — editable in edit mode */}
        {isEditing ? (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Título
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
              placeholder="Título de la idea"
            />
          </div>
        ) : null}

        {/* Row 1: Creada | Actualizada */}
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Creada
            </dt>
            <dd className="mt-1 text-sm text-slate-300">
              {formattedCreated}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Actualizada
            </dt>
            <dd className="mt-1 text-sm text-slate-300">
              {formattedUpdated}
            </dd>
          </div>
        </dl>

        {/* Row 2: Descripción */}
        <div className="mb-4">
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Descripción
          </dt>
          {isEditing ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-y"
              placeholder="Describe la idea"
            />
          ) : (
            <div className="space-y-2">
              <ClampText text={idea.description} lines={2} />
              {idea.originalIdea && idea.originalIdea !== idea.description && (
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer hover:text-slate-300 transition-colors">
                    Ver texto original
                  </summary>
                  <div className="mt-2 pl-3 border-l-2 border-slate-700">
                    <TextExpander text={idea.originalIdea} className="text-sm text-slate-400 italic" maxLength={300} />
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Row 3+4: Usuario objetivo | Monetización + Problema | Propuesta de valor */}
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Usuario objetivo | Monetización */}
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Usuario objetivo
            </dt>
            {isEditing ? (
              <textarea
                value={editTargetUser}
                onChange={(e) => setEditTargetUser(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-y"
              />
            ) : (
              <dd className="mt-1">
                <ClampText text={idea.targetUser} lines={3} />
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Monetización
            </dt>
            {isEditing ? (
              <textarea
                value={editMonetization}
                onChange={(e) => setEditMonetization(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-y"
              />
            ) : (
              <dd className="mt-1">
                <ClampText text={idea.monetization} lines={3} />
              </dd>
            )}
          </div>

          {/* Problema | Propuesta de valor */}
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Problema que resuelve
            </dt>
            {isEditing ? (
              <textarea
                value={editProblem}
                onChange={(e) => setEditProblem(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-y"
                placeholder="Describe el problema"
              />
            ) : (
              <dd className="mt-1">
                {idea.problem ? (
                  <ClampText text={idea.problem} lines={3} />
                ) : (
                  <span className="text-sm text-slate-600">—</span>
                )}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Propuesta de valor
            </dt>
            {isEditing ? (
              <textarea
                value={editValueProposition}
                onChange={(e) => setEditValueProposition(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-y"
                placeholder="Describe la propuesta de valor"
              />
            ) : (
              <dd className="mt-1">
                {idea.valueProposition ? (
                  <ClampText text={idea.valueProposition} lines={3} />
                ) : (
                  <span className="text-sm text-slate-600">—</span>
                )}
              </dd>
            )}
          </div>
        </dl>
      </div>
      </>
      )}

      {/* Reports — only when validation is done and not DRAFT */}
      {idea.validationStatus === "DONE" && idea.reports.length > 0 && idea.status !== "DRAFT" && (() => {
        const reportDate = idea.reports[0]?.createdAt
          ? new Date(idea.reports[0].createdAt).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "—";
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Reportes</h2>
              <p className="mt-1 text-sm text-slate-500">
                Generados: {reportDate}
              </p>
            </div>
            {idea.reports.map((report) => (
              <ReportViewer key={report.id} report={report} />
            ))}
          </div>
        );
      })()}

      {/* Generation failure — the idea was never produced */}
      {isGenerationFailure && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon />
            <div>
              <h3 className="text-lg font-semibold text-red-400">
                Error al generar la idea
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                No se pudo generar la idea. Puedes reintentar la generación con
                los mismos datos.
              </p>
              {idea.failureReason && (
                <p className="mt-2 text-sm text-red-300/80 break-words">
                  {idea.failureReason}
                </p>
              )}
              <Button
                variant="danger"
                onClick={handleRegenerate}
                disabled={regenerating}
                title={
                  bridgeDown
                    ? "El servicio de IA no está disponible"
                    : undefined
                }
                className="mt-4 bg-red-500/20 font-medium text-red-400 hover:bg-red-500/30"
              >
                {regenerating ? "Reintentando…" : "Reintentar generación"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Validation failure — the idea had content but validation failed */}
      {isValidationFailure && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon />
            <div>
              <h3 className="text-lg font-semibold text-red-400">
                Error en la validación
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Ocurrió un error durante el proceso de validación. Puedes
                reintentarlo.
              </p>
              {idea.failureReason && (
                <p className="mt-2 text-sm text-red-300/80 break-words">
                  {idea.failureReason}
                </p>
              )}
              <Button
                variant="danger"
                onClick={handleValidate}
                disabled={validating}
                className="mt-4 bg-red-500/20 font-medium text-red-400 hover:bg-red-500/30"
              >
                {validating ? "Reintentando…" : "Reintentar validación"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de límite de plan al refinar (cuota agotada → 403) */}
      <DemoLimitDialog
        open={refineLimit}
        onClose={() => setRefineLimit(false)}
        type="refine"
      />

      {/* Diálogo de límite de plan al mejorar (cuota agotada → 403). Reutiliza
          el tipo "refine" según el contrato. */}
      <DemoLimitDialog
        open={improveLimit}
        onClose={() => setImproveLimit(false)}
        type="refine"
      />

      {/* Confirm modals */}
      <ConfirmModal
        open={showDeleteModal}
        title="Eliminar idea"
        message="¿Seguro que quieres eliminar esta idea? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
      <ConfirmModal
        open={showCancelValidationConfirm}
        title="¿Detener la validación?"
        message="Se cancelarán los informes en curso y se borrarán los reports parciales. Podrás volver a validar la idea desde cero cuando quieras."
        confirmText="Detener"
        variant="danger"
        onConfirm={handleCancelValidation}
        onCancel={() => setShowCancelValidationConfirm(false)}
      />
    </div>
  );
}

/* ── Icons ── */

function Spinner({ large }: { large?: boolean }) {
  return (
    <svg
      className={`${large ? "size-8" : "size-4"} animate-spin text-amber-400`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg className="size-5 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/* ── Convertir en proyecto button ── */
function ConvertToProjectButton({ ideaId }: { ideaId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectLimit, setProjectLimit] = useState(false);
  const router = useRouter();

  async function handleConvert() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.projectId) {
          window.dispatchEvent(new CustomEvent("project-changed"));
          router.push(`/proyectos/${data.projectId}`);
          return;
        }
        if (res.status === 403) {
          // Límite de proyectos del plan: abrimos el diálogo de ampliación.
          setProjectLimit(true);
          return;
        }
        setError(data.error || "Error al crear proyecto");
      } else {
        window.dispatchEvent(new CustomEvent("project-changed"));
        router.push(`/proyectos/${data.project.id}`);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={handleConvert}
        disabled={loading}
        className="gap-2 py-2.5 border-amber-500/40 bg-amber-500/10 font-medium text-amber-400 shadow hover:border-amber-400 hover:bg-amber-500/20"
      >
        <FolderKanban className="size-4" />
        {loading ? "Creando proyecto…" : "Convertir en proyecto"}
      </Button>
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
      <DemoLimitDialog
        open={projectLimit}
        onClose={() => setProjectLimit(false)}
        type="projects"
        message="Has alcanzado el máximo de proyectos de tu plan."
      />
    </>
  );
}
