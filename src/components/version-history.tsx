"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { History, RotateCcw, X, Eye } from "lucide-react";

interface VersionData {
  id: string;
  ideaId: string;
  title: string;
  description: string;
  targetUser: string;
  monetization: string;
  phase: string;
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

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/versions`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Error al cargar versiones");
      const data = await res.json();
      setVersions(data);
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

  const phaseLabel: Record<string, string> = {
    "initial": "Inicial",
    "pre-validation": "Pre-validación",
    "post-validation": "Post-validación",
  };

  const phaseColor: Record<string, string> = {
    "initial": "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "pre-validation": "text-amber-400 bg-amber-500/10 border-amber-500/30",
    "post-validation": "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <History className="size-5 text-slate-400" />
          Historial de versiones
        </h2>
        <p className="text-sm text-slate-500">Cargando versiones…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <History className="size-5 text-slate-400" />
          Historial de versiones
        </h2>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
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

      {versions.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay versiones guardadas todavía. Se crearán automáticamente al
          validar o refinar la idea.
        </p>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 p-4 transition-colors hover:border-slate-700"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-white truncate">
                    {v.title}
                  </h3>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs ${phaseColor[v.phase] ?? "text-slate-400 bg-slate-500/10 border-slate-500/30"}`}
                  >
                    {phaseLabel[v.phase] ?? v.phase}
                  </span>
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
              <div className="flex items-center gap-1.5 ml-4 shrink-0">
                <button
                  onClick={() => setSelectedVersion(v)}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title="Ver detalles"
                >
                  <Eye className="size-3.5" />
                  Ver
                </button>
                <button
                  onClick={() => handleRestore(v.id)}
                  disabled={restoring}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Restaurar esta versión"
                >
                  <RotateCcw className="size-3.5" />
                  {restoreId === v.id ? "Restaurando…" : "Restaurar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Version detail modal */}
      {selectedVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedVersion(null)}
        >
          <div
            className="relative mx-4 w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">
                Detalle de versión
              </h3>
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
                  Fase
                </dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${phaseColor[selectedVersion.phase] ?? "text-slate-400 bg-slate-500/10 border-slate-500/30"}`}
                  >
                    {phaseLabel[selectedVersion.phase] ?? selectedVersion.phase}
                  </span>
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
                  Descripción
                </dt>
                <dd className="mt-1 text-sm text-slate-300 leading-relaxed">
                  {selectedVersion.description}
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
              <button
                onClick={() => setSelectedVersion(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => handleRestore(selectedVersion.id)}
                disabled={restoring}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow transition-colors hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
