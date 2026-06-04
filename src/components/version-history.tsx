"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { History, RotateCcw, X, Eye, FileDown } from "lucide-react";
import { getScoreColor } from "@/lib/translations";
import { generatePdf } from "@/lib/pdf-export";

interface ReportSnapshot {
  agentName: string;
  title: string;
  content: string;
  verdict: string | null;
  scorecard: string | null;
  createdAt: string;
}

interface VersionData {
  id: string;
  ideaId: string;
  title: string;
  description: string;
  problem: string | null;
  valueProposition: string | null;
  targetUser: string;
  monetization: string;
  phase: string;
  score: number | null;
  verdict: string | null;
  reportsSnapshot: ReportSnapshot[] | null;
  createdAt: string;
}

interface VersionHistoryProps {
  ideaId: string;
}

export function VersionHistory({ ideaId }: VersionHistoryProps) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<VersionData | null>(
    null
  );
  const [restoring, setRestoring] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/versions`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Error al cargar versiones");
      const data = await res.json();
      // Filter out V0 (placeholder versions, only show real ones)
      setVersions((data as VersionData[]).filter((v: VersionData) => v.phase !== "v0"));
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar versiones"
      );
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  async function handleRestore(versionId: string) {
    setRestoring(true);
    setRestoreId(versionId);
    try {
      const res = await fetch(
        `/api/ideas/${ideaId}/versions/${versionId}/restore`,
        {
          method: "POST",
          credentials: "same-origin",
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al restaurar");
      }
      setSelectedVersion(null);
      // Refresh versions list and trigger parent page refresh
      await fetchVersions();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al restaurar la versión"
      );
    } finally {
      setRestoring(false);
      setRestoreId(null);
    }
  }

  async function handleExportPdf(version: VersionData, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setExportingId(version.id);
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Error al cargar idea para PDF");
      const idea = await res.json();

      // Build export data using version snapshot
      const exportData = {
        ...idea,
        title: version.title,
        description: version.description,
        problem: version.problem || "",
        valueProposition: version.valueProposition || "",
        targetUser: version.targetUser,
        monetization: version.monetization,
        score: version.score,
        verdict: version.verdict,
        businessModel: idea.businessModel || "No definido",
        versions: idea.versions || [],
        reports: (version.reportsSnapshot || []).map((r) => ({
          agentName: r.agentName,
          title: r.title,
          content: r.content,
          verdict: r.verdict,
          scorecard: r.scorecard,
          createdAt: r.createdAt,
        })),
        versionPhase: version.phase,
      };

      const filename = `${version.title.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/g, "_").slice(0, 60)}-${version.phase}.pdf`;
      generatePdf(filename, exportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar PDF");
    } finally {
      setExportingId(null);
    }
  }

  const phaseLabel: Record<string, string> = {
    "v0": "V0",
    "v1": "V1",
    "v2": "V2",
    "v3": "V3",
    "v4": "V4",
    "v5": "V5",
    "v6": "V6",
    "v7": "V7",
    "v8": "V8",
  };

  const phaseColor: Record<string, string> = {
    "v0": "text-slate-400 bg-slate-500/10 border-slate-500/30",
    "v1": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "v2": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "v3": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "v4": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "v5": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "v6": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "v7": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "v8": "text-blue-400 bg-blue-500/10 border-blue-500/30",
  };

  function getPhaseStyle(phase: string) {
    if (phase.match(/^v\d+$/)) {
      return phaseColor[phase] ?? "text-blue-400 bg-blue-500/10 border-blue-500/30";
    }
    if (phase === "initial" || phase === "pre-validation") {
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    }
    return "text-slate-400 bg-slate-500/10 border-slate-500/30";
  }

  function getPhaseDisplay(phase: string) {
    if (phase.match(/^v\d+$/)) {
      return phaseLabel[phase] ?? phase.toUpperCase();
    }
    const map: Record<string, string> = {
      "initial": "Inicial",
      "pre-validation": "Pre-validación",
      "post-validation": "Post-validación",
    };
    return map[phase] ?? phase;
  }

  const isActual = (index: number) => index === 0;

  // Don't render section at all if no versions
  if (loading) {
    return null;
  }

  if (error || versions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <History className="size-5 text-slate-400" />
        Historial de versiones
        <span className="text-xs font-normal text-slate-500 ml-2">
          ({versions.length})
        </span>
      </h2>

      <div className="space-y-3">
        {versions.map((v, idx) => (
          <div
            key={v.id}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 rounded-lg border border-slate-800 bg-slate-900/80 p-4 transition-colors hover:border-slate-700"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium text-white truncate">
                  {v.title}
                </h3>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs ${getPhaseStyle(v.phase)}`}
                >
                  {getPhaseDisplay(v.phase)}
                </span>
                {isActual(idx) && (
                  <span className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                    Actual
                  </span>
                )}
                {v.score !== null && (
                  <span className={`text-xs font-semibold tabular-nums ${getScoreColor(v.score)}`}>
                    {v.score.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(v.createdAt).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {/* Action buttons — hidden for current version */}
            {!isActual(idx) && (
              <div className="flex items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t border-slate-800 md:border-t-0 md:ml-4">
                <button
                  onClick={() => setSelectedVersion(v)}
                  className="inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Ver detalles"
                >
                  <Eye className="size-3.5" />
                  <span className="hidden md:inline">Ver</span>
                </button>
                <button
                  onClick={(e) => handleExportPdf(v, e)}
                  disabled={exportingId === v.id}
                  className="inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
                  title="Exportar PDF"
                >
                  <FileDown className="size-3.5" />
                  <span className="hidden md:inline">{exportingId === v.id ? "…" : "PDF"}</span>
                </button>
                <button
                  onClick={() => handleRestore(v.id)}
                  disabled={restoring}
                  className="inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Restaurar esta versión"
                >
                  <RotateCcw className="size-3.5" />
                  <span className="hidden md:inline">{restoreId === v.id ? "…" : "Restaurar"}</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Version detail modal */}
      {selectedVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedVersion(null)}
        >
          <div
            className="relative mx-4 w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4 rounded-t-xl">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">
                  Detalle de versión
                </h3>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${getPhaseStyle(selectedVersion.phase)}`}
                >
                  {getPhaseDisplay(selectedVersion.phase)}
                </span>
                {selectedVersion.score !== null && (
                  <span className="text-sm font-semibold text-amber-400">
                    {selectedVersion.score.toFixed(1)}/10
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedVersion(null)}
                className="rounded-md p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Título
                </dt>
                <dd className="mt-1 text-sm text-white">
                  {selectedVersion.title}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Fecha
                </dt>
                <dd className="mt-1 text-sm text-slate-300">
                  {new Date(selectedVersion.createdAt).toLocaleDateString(
                    "es-ES",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Veredicto
                </dt>
                <dd className="mt-1 text-sm text-slate-300">
                  {selectedVersion.verdict || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Descripción
                </dt>
                <dd className="mt-1 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedVersion.description}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Problema que resuelve
                </dt>
                <dd className="mt-1 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedVersion.problem || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Propuesta de valor
                </dt>
                <dd className="mt-1 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedVersion.valueProposition || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Usuario objetivo
                </dt>
                <dd className="mt-1 text-sm text-slate-300">
                  {selectedVersion.targetUser}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Monetización
                </dt>
                <dd className="mt-1 text-sm text-slate-300">
                  {selectedVersion.monetization}
                </dd>
              </div>

              {/* Reports snapshot */}
              {selectedVersion.reportsSnapshot && selectedVersion.reportsSnapshot.length > 0 && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    Reportes ({selectedVersion.reportsSnapshot.length})
                  </dt>
                  <div className="space-y-3">
                    {selectedVersion.reportsSnapshot.map((r, ri) => (
                      <div
                        key={ri}
                        className="rounded-lg border border-slate-800 bg-slate-950/60 p-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase">
                            {r.agentName}
                          </span>
                          {r.verdict && (
                            <span className="text-xs text-slate-500">
                              — {r.verdict}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-6">
                          {r.content.slice(0, 500)}
                          {r.content.length > 500 ? "…" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900 px-6 py-4 rounded-b-xl">
              <button
                onClick={() => setSelectedVersion(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={(e) => handleExportPdf(selectedVersion, e)}
                disabled={exportingId === selectedVersion.id}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-600 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                <FileDown className="size-4" />
                {exportingId === selectedVersion.id ? "Exportando…" : "Exportar PDF"}
              </button>
              <button
                onClick={() => handleRestore(selectedVersion.id)}
                disabled={restoring || versions[0]?.id === selectedVersion.id}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow transition-colors hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title={versions[0]?.id === selectedVersion.id ? "Ya es la versión activa" : "Restaurar esta versión"}
              >
                <RotateCcw className="size-4" />
                {restoring ? "Restaurando…" : "Restaurar versión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
