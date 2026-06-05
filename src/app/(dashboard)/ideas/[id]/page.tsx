"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Archive, Trash2, Undo2, MoreHorizontal, Pencil, FileDown, Save, X, Info, AlertCircle, History } from "lucide-react";
import { ValidationProgress } from "@/components/validation-progress";
import { ReportViewer } from "@/components/report-viewer";
import { ConfirmModal } from "@/components/confirm-modal";
import RefineIdeaSection from "@/components/refine-idea-section";
import { VersionHistory } from "@/components/version-history";
import { getScoreColor, STATUS_LABELS, STATUS_COLORS } from "@/lib/translations";
import { BUSINESS_MODELS } from "@/lib/business-models";
import { BusinessModelIcon } from "@/components/business-model-icon";
import { generatePdf } from "@/lib/pdf-export";
import { TextExpander } from "@/components/text-expander";
import { useBridgeStatus } from "@/hooks/use-bridge-status";
import { isIdeaBusy } from "@/lib/idea-state";

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
  isFavorite: boolean;
  isArchived: boolean;
  currentVersionId: string | null;
  currentVersionPhase: string | null;
  /**
   * Echoed by GET /api/ideas/:id?versionId=… — the version currently
   * rendered. Null when no versionId was passed (= live/current).
   */
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  reports: ReportData[];
  _versionCount?: number;
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
  const ideaId = params.id as string;

  const [idea, setIdea] = useState<IdeaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [apiError, setApiError] = useState("");
  const [favPending, setFavPending] = useState(false);
  const [archPending, setArchPending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const initiallyOpened = useRef(false);
  const [showRefineSection, setShowRefineSection] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startingPolish, setStartingPolish] = useState(false);
  const [cancellingPolish, setCancellingPolish] = useState(false);
  const [cancellingValidation, setCancellingValidation] = useState(false);
  const [showCancelValidationConfirm, setShowCancelValidationConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProblem, setEditProblem] = useState("");
  const [editValueProposition, setEditValueProposition] = useState("");
  const [editTargetUser, setEditTargetUser] = useState("");
  const [editMonetization, setEditMonetization] = useState("");
  // When set, the page is rendering a historical version of the idea
  // (not the current one). Cleared when the user goes back to "actual".
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
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
      // If the user is viewing a historical version, scope the GET to it
      // so the page renders that version's text/fields/reports.
      const query = viewingVersionId
        ? `?versionId=${encodeURIComponent(viewingVersionId)}`
        : "";
      const res = await fetch(`/api/ideas/${ideaId}${query}`, {
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
  }, [ideaId, router, viewingVersionId]);

  // Initial load
  useEffect(() => {
    fetchIdea();
  }, [fetchIdea]);

  // Refetch whenever the user navigates to a different version in the
  // history panel. fetchIdea already depends on viewingVersionId, so this
  // is just a safety net in case the callback runs after the page mount.
  useEffect(() => {
    if (viewingVersionId !== null) {
      fetchIdea();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingVersionId]);

  // Polling when validating or when idea generation is in progress
  const shouldPoll =
    idea?.validationStatus === "RUNNING" ||
    (idea?.status === "DRAFT" && idea?.validationStatus === "PENDING");

  useEffect(() => {
    if (shouldPoll) {
      pollRef.current = setInterval(fetchIdea, 3000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [shouldPoll, fetchIdea]);

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

  async function toggleFavorite() {
    if (!idea || favPending) return;
    setFavPending(true);
    const next = !idea.isFavorite;
    setIdea({ ...idea, isFavorite: next });
    try {
      await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ isFavorite: next }),
      });
    } catch {
      setIdea({ ...idea, isFavorite: !next });
    } finally {
      setFavPending(false);
    }
    setShowMenu(false);
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

  // ── Polish start / cancel ──

  async function handleStartPolish() {
    // The "Continuar pulido" button is shown both for fresh
    // Pulir-idea (idea.status === "COMPLETED") and for resuming
    // an in-progress polish (idea.status === "POLISHING"). The
    // latter only needs to re-open the local card from
    // localStorage, so it must work even when the bridge is down
    // — the user can pick up where they left off without talking
    // to the daemon. We only block when starting a new polish.
    const resumingExisting = idea?.status === "POLISHING";
    if (!resumingExisting && bridgeDown) {
      setApiError(
        "El servicio de IA no está disponible. El servidor local puede estar apagado. Inténtalo más tarde."
      );
      return;
    }
    setStartingPolish(true);
    setApiError("");
    try {
      if (!resumingExisting) {
        await fetch(`/api/ideas/${ideaId}/refine/start`, {
          method: "POST",
          credentials: "same-origin",
        });
      }
      await fetchIdea();
      setShowRefineSection(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al iniciar el pulido");
    } finally {
      setStartingPolish(false);
    }
  }

  async function handleCancelPolish() {
    setCancellingPolish(true);
    setApiError("");
    try {
      await fetch(`/api/ideas/${ideaId}/refine/cancel`, {
        method: "PATCH",
        credentials: "same-origin",
      });
      // Clear localStorage
      localStorage.removeItem(`brew-refine-${ideaId}`);
      setShowRefineSection(false);
      await fetchIdea();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error al cancelar el pulido");
    } finally {
      setCancellingPolish(false);
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

  // ── States ──

  // Auto-open refine section ONLY the first time the page loads with
  // the idea in POLISHING. We use a ref to avoid re-opening after the
  // user has explicitly closed the wizard (via X or after discarding
  // the proposal). A "section collapsed" flag in localStorage tracks the
  // user intent.
  useEffect(() => {
    if (!idea) return;
    // First load? Auto-open if POLISHING or there's a saved session.
    if (initiallyOpened.current) return;
    initiallyOpened.current = true;
    if (idea.status === "POLISHING") {
      setShowRefineSection(true);
      return;
    }
    try {
      const raw = localStorage.getItem(`brew-refine-${idea.id}`);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (
        saved &&
        saved.screen !== "choice" &&
        saved.screen !== "applied"
      ) {
        setShowRefineSection(true);
      }
    } catch {
      // Ignore parse errors
    }
  }, [idea]);

  // Check if there's an active refine session (for REFINING badge)
  const isRefining = (() => {
    if (idea?.status === "POLISHING") return true;
    try {
      const raw = localStorage.getItem(`brew-refine-${ideaId}`);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      return (
        saved &&
        saved.screen !== "choice"
      );
    } catch {
      return false;
    }
  })();

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
  // mientras la idea está siendo procesada por el bridge.
  const isBusy = isIdeaBusy(idea.status);
  const canValidate =
    !isBusy &&
    idea.validationStatus !== "RUNNING" &&
    idea.validationStatus !== "DONE";
  const isDraft = idea.status === "DRAFT";
  // When the user is browsing a historical version the action buttons
  // are disabled — they would otherwise mutate the LIVE idea (the
  // backend doesn't know how to operate on a past version). The user
  // has to go back to the current version first.
  const isViewingHistorical =
    viewingVersionId !== null &&
    idea.activeVersionId !== null &&
    viewingVersionId !== idea.currentVersionId;

  // Version badge: dynamic according to state (DRAFT / COMPLETED)
  // POLISHING state uses the status badge (already shows "Puliendo")
  const versionBadge = (() => {
    if (!isCompleted) {
      return { label: "Borrador", color: "bg-slate-700/30 text-slate-400 border-slate-700" };
    }
    // Estado COMPLETED
    const phase = idea.currentVersionPhase;
    return { label: phase ? phase.toUpperCase() : "V?", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
  })();

  // No subtext — the status badge (DRAFT / Puliendo / etc) already says enough
  const versionSubtext: string | null = null;

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
      <Link
        href="/ideas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeftIcon />
        Volver a ideas
      </Link>

      {/* Header */}
      <div className="mb-8">
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

              {/* 3-dot menu */}
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
                    {/* Favorite / Unfavorite — hidden if archived */}
                    {!idea.isArchived && (
                      <button
                        onClick={toggleFavorite}
                        disabled={favPending}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <Heart
                          className={`size-4 ${idea.isFavorite ? "text-red-400" : "text-slate-400"}`}
                          fill={idea.isFavorite ? "currentColor" : "none"}
                        />
                        {idea.isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                      </button>
                    )}

                    {/* Archive / Unarchive — hidden if favorited */}
                    {!idea.isFavorite && (
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
            </div>

            {/* Badges: Version | Business type | Status | Score */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* 1. Version badge */}
              <div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${versionBadge.color}`}
                >
                  {versionBadge.label}
                </span>
                {versionSubtext && (
                  <p className="mt-1 text-xs text-slate-500">{versionSubtext}</p>
                )}
              </div>

              {/* 2. Business type badge */}
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
                {(idea.status === "GENERATING" || idea.status === "VALIDATING" || idea.status === "REFINING" || isRefining) && (
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
                <button
                  onClick={handleValidate}
                  disabled={validating || isViewingHistorical}
                  title={
                    isViewingHistorical
                      ? "Vuelve a la versión actual para validar"
                      : bridgeDown
                        ? "El servicio de IA no está disponible"
                        : undefined
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {validating ? (
                    <>
                      <Spinner />
                      Iniciando…
                    </>
                  ) : (
                    <>
                      <ZapIcon />
                      {isDraft ? "Validar esta idea" : "Validar con IA"}
                    </>
                  )}
                </button>
              )}
              {/* Pulir idea — solo aparece cuando la idea ya está validada y no está puliendo */}
              {!showRefineSection && (idea.status === "COMPLETED" || idea.status === "POLISHING") && (
                <button
                  onClick={handleStartPolish}
                  disabled={startingPolish || isViewingHistorical}
                  title={
                    isViewingHistorical
                      ? "Vuelve a la versión actual para pulir"
                      : undefined
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-400 shadow transition-all hover:border-amber-400 hover:bg-amber-500/20 active:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {startingPolish ? (
                    <>
                      <Spinner />
                      Iniciando…
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      {idea.status === "POLISHING" ? "Continuar pulido" : "Pulir idea"}
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleExportPdf}
                disabled={isViewingHistorical || isBusy}
                title={
                  isViewingHistorical
                    ? "Vuelve a la versión actual para exportar"
                    : isBusy
                      ? "Espera a que termine el procesamiento actual"
                      : undefined
                }
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-300 shadow transition-all hover:border-slate-600 hover:text-slate-200 active:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileDown className="size-4" />
                Exportar informe
              </button>
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

      {/* HISTORICAL VERSION banner — shown when viewing a non-current version */}
      {viewingVersionId && idea.activeVersionId && viewingVersionId === idea.activeVersionId && viewingVersionId !== idea.currentVersionId && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <History className="size-4 shrink-0 text-amber-400" />
            <span className="text-sm text-amber-200">
              Estás viendo una versión histórica. Los reportes y datos que ves pertenecen a esta versión, no a la actual.
            </span>
          </div>
          <button
            onClick={() => {
              setViewingVersionId(null);
              fetchIdea();
            }}
            className="shrink-0 rounded-md border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            Volver a versión actual
          </button>
        </div>
      )}

      {/* POLISHING banner — appears when idea is being polished */}
      {idea.status === "POLISHING" && (
        <div className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Info className="size-4 shrink-0 text-blue-400" />
            <span className="text-sm text-blue-300">
              Estás puliendo esta idea. Si recargas o cambias de pantalla después podrás continuar donde lo dejaste.
            </span>
          </div>
          <button
            onClick={handleCancelPolish}
            disabled={cancellingPolish}
            className="shrink-0 rounded-md border border-blue-500/30 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancellingPolish ? "Cancelando…" : "Cancelar"}
          </button>
        </div>
      )}

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

      {/* Inline Refine Section */}
      {showRefineSection && (
        <RefineIdeaSection
          idea={{
            id: idea.id,
            title: idea.title,
            description: idea.description,
            problem: idea.problem,
            valueProposition: idea.valueProposition,
            targetUser: idea.targetUser,
            monetization: idea.monetization,
          }}
          onCollapse={() => setShowRefineSection(false)}
          onApplied={() => {
            fetchIdea();
          }}
          onValidate={handleValidate}
        />
      )}

      {/* Idea original / Edit mode */}
      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            {isEditing ? "Editando idea" : "Idea original"}
          </h2>
          {isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="size-3.5" />
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow transition-colors hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Spinner />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    Guardar
                  </>
                )}
              </button>
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
              <TextExpander text={idea.description} />
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
                <TextExpander text={idea.targetUser} />
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
                <TextExpander text={idea.monetization} />
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
                  <TextExpander text={idea.problem} />
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
                  <TextExpander text={idea.valueProposition} />
                ) : (
                  <span className="text-sm text-slate-600">—</span>
                )}
              </dd>
            )}
          </div>
        </dl>
      </div>

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

      {/* Version history */}
      <div className="mt-8">
        <VersionHistory
          ideaId={idea.id}
          currentVersionId={idea.currentVersionId}
          activeVersionId={idea.activeVersionId}
          onVersionChange={(versionId) => {
            setViewingVersionId(versionId);
          }}
        />
      </div>

      {/* Failed state */}
      {idea.validationStatus === "FAILED" && (
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
              <button
                onClick={handleValidate}
                disabled={validating}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {validating ? "Reintentando…" : "Reintentar validación"}
              </button>
            </div>
          </div>
        </div>
      )}

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

function SparklesIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
