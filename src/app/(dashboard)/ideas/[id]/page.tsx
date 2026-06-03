"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Archive, Trash2, Undo2, MoreHorizontal } from "lucide-react";
import { ValidationProgress } from "@/components/validation-progress";
import { ReportViewer } from "@/components/report-viewer";
import { ConfirmModal } from "@/components/confirm-modal";
import { translateVerdict, translateStatus } from "@/lib/translations";

interface IdeaData {
  id: string;
  title: string;
  description: string;
  originalIdea: string | null;
  targetUser: string;
  monetization: string;
  status: string;
  validationStatus: string;
  verdict: string | null;
  score: number | null;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  reports: ReportData[];
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [favPending, setFavPending] = useState(false);
  const [archPending, setArchPending] = useState(false);
  const [showReformulate, setShowReformulate] = useState(false);
  const [reformulating, setReformulating] = useState(false);
  const [reformulatePrompt, setReformulatePrompt] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReformulateWarningModal, setShowReformulateWarningModal] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Polling when validating
  useEffect(() => {
    if (idea?.validationStatus === "RUNNING") {
      pollRef.current = setInterval(fetchIdea, 3000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [idea?.validationStatus, fetchIdea]);

  // Elapsed timer
  useEffect(() => {
    if (idea?.validationStatus === "RUNNING") {
      const interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
    setElapsedSeconds(0);
  }, [idea?.validationStatus]);

  const isCompleted =
    idea?.validationStatus === "DONE" ||
    idea?.status === "COMPLETED" ||
    idea?.status === "DONE";

  async function handleValidate() {
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

  function openReformulate() {
    if (isCompleted) {
      setShowReformulateWarningModal(true);
    } else {
      setShowReformulate(true);
      setReformulatePrompt("");
    }
    setShowMenu(false);
  }

  function confirmOpenReformulate() {
    setShowReformulateWarningModal(false);
    setShowReformulate(true);
    setReformulatePrompt("");
  }

  async function handleReformulate() {
    if (!reformulatePrompt.trim()) return;
    setReformulating(true);
    setApiError("");
    try {
      const res = await fetch(`/api/ideas/${ideaId}/reformulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ prompt: reformulatePrompt }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al reformular");
      }
      const updated = await res.json();
      setIdea(updated);
      setShowReformulate(false);
      setReformulatePrompt("");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Error");
    } finally {
      setReformulating(false);
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

  // ── States ──

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

  const verdictBadge = getVerdictBadge(idea.verdict);
  const elapsedStr = formatElapsed(elapsedSeconds);

  const canValidate =
    idea.validationStatus !== "RUNNING" && idea.validationStatus !== "DONE";

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
              <StatusBadge
                status={idea.status}
                validationStatus={idea.validationStatus}
              />
              {idea.isArchived && (
                <span className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium text-amber-400 bg-amber-500/10 border-amber-500/30">
                  Archivada
                </span>
              )}
              {verdictBadge && verdictBadge}
              {idea.score !== null && (
                <span className="text-sm font-semibold text-amber-400 tabular-nums">
                  {idea.score.toFixed(1)}/10
                </span>
              )}
              {idea.validationStatus === "RUNNING" && (
                <span className="text-sm text-amber-400 tabular-nums">
                  {elapsedStr}
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

                    {/* Reformulate */}
                    {(idea.status === "DRAFT" || isCompleted) && (
                      <button
                        onClick={openReformulate}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        <EditIcon />
                        Reformular idea
                      </button>
                    )}

                    {/* Separator */}
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

            {/* Score bar */}
            {idea.score !== null && (
              <div className="mt-2 h-2 w-full max-w-[200px] rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${((idea.score ?? 0) / 10) * 100}%` }}
                />
              </div>
            )}

            {/* Action buttons: Validate + Reformulate — below title & badge */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {canValidate && (
                <button
                  onClick={handleValidate}
                  disabled={validating}
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
                      Validar con IA
                    </>
                  )}
                </button>
              )}
              {(idea.status === "DRAFT" || isCompleted) && (
                <button
                  onClick={openReformulate}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 shadow transition-all hover:border-slate-600 hover:bg-slate-700 active:bg-slate-900"
                >
                  <EditIcon />
                  Reformular idea
                </button>
              )}
            </div>

            {apiError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {apiError}
              </div>
            )}

            {/* Reformulate form */}
            {showReformulate && (
              <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900 p-5">
                <h3 className="text-base font-semibold text-white mb-4">
                  <EditIcon /> Reformular idea
                </h3>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="reformulate-prompt"
                      className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2"
                    >
                      Indicaciones para reformular
                    </label>
                    <textarea
                      id="reformulate-prompt"
                      value={reformulatePrompt}
                      onChange={(e) => setReformulatePrompt(e.target.value)}
                      placeholder="Ej: enfócate en jóvenes, cambia el modelo de negocio a suscripción mensual, añade gamificación..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/50 focus:outline-none resize-y"
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleReformulate}
                      disabled={reformulating || !reformulatePrompt.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reformulating ? (
                        <>
                          <Spinner />
                          Reformulando…
                        </>
                      ) : (
                        <>
                          <RefreshIcon />
                          Aplicar reformulación
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowReformulate(false);
                        setReformulatePrompt("");
                      }}
                      className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Idea original — always shown */}
      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Idea original
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          {idea.originalIdea || idea.description}
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Usuario objetivo
            </dt>
            <dd className="mt-1 text-sm text-slate-300">{idea.targetUser}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Monetización
            </dt>
            <dd className="mt-1 text-sm text-slate-300">{idea.monetization}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Creada
            </dt>
            <dd className="mt-1 text-sm text-slate-300">
              {new Date(idea.createdAt).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Validation progress */}
      {(idea.validationStatus === "RUNNING" ||
        idea.validationStatus === "DONE" ||
        idea.validationStatus === "FAILED") && (
        <div className="mb-8">
          <ValidationProgress
            validationStatus={idea.validationStatus}
            reports={idea.reports}
            elapsedSeconds={elapsedSeconds}
          />
        </div>
      )}

      {/* Reports */}
      {idea.validationStatus === "DONE" && idea.reports.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Reportes</h2>
          {idea.reports.map((report) => (
            <ReportViewer key={report.id} report={report} />
          ))}
        </div>
      )}

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

      {/* Idea details (for DRAFT or PENDING state, without validation) */}
      {idea.validationStatus !== "DONE" &&
        idea.validationStatus !== "RUNNING" &&
        idea.validationStatus !== "FAILED" && idea.description !== (idea.originalIdea || idea.description) && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Descripción actual
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {idea.description}
            </p>
          </div>
        )}

      {/* Delete button — bottom right, gray */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="size-4" />
          Eliminar idea
        </button>
      </div>

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
        open={showReformulateWarningModal}
        title="Reformular idea validada"
        message="Al reformular una idea ya validada, se perderán los resultados anteriores. ¿Continuar?"
        confirmText="Continuar"
        variant="default"
        onConfirm={confirmOpenReformulate}
        onCancel={() => setShowReformulateWarningModal(false)}
      />
    </div>
  );
}

/* ── Helpers ── */

function getVerdictBadge(verdict: string | null) {
  if (!verdict) return null;

  const styles: Record<string, string> = {
    GO: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    PIVOT: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    KILL: "text-red-400 bg-red-500/10 border-red-500/30",
    ITERATE: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  };

  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${styles[verdict] || "text-slate-400 bg-slate-500/10 border-slate-500/30"}`}
    >
      {translateVerdict(verdict)}
    </span>
  );
}

function StatusBadge({
  status,
  validationStatus,
}: {
  status: string;
  validationStatus: string;
}) {
  const label =
    validationStatus === "RUNNING"
      ? "En progreso"
      : validationStatus === "DONE"
        ? "Finalizado"
        : validationStatus === "FAILED"
          ? "Falló"
          : translateStatus(status);

  const color =
    validationStatus === "RUNNING"
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : validationStatus === "DONE"
        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
        : validationStatus === "FAILED"
          ? "text-red-400 bg-red-500/10 border-red-500/30"
          : "text-slate-400 bg-slate-500/10 border-slate-500/30";

  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds === 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
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

function EditIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
