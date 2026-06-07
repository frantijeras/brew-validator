"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";

export default function PhaseViewPage() {
  const params = useParams<{ id: string; phaseId: string }>();
  const projectId = params.id;
  const phaseId = params.phaseId;

  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/phases/${phaseId}/view`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            data?.error || `Error ${res.status}: No se pudo cargar el contenido`
          );
        }
        const text = await res.text();
        if (!cancelled) {
          setHtml(text);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error al cargar el contenido"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, phaseId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header con breadcrumb */}
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="px-4 py-3 sm:px-6">
          <Link
            href={`/proyectos/${projectId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white hover:border-slate-600"
          >
            <ArrowLeft className="size-4" />
            Volver al proyecto
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-sm">Cargando contenido...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3 max-w-md text-center">
              <AlertTriangle className="size-8 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
              <Link
                href={`/proyectos/${projectId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Volver al proyecto
              </Link>
            </div>
          </div>
        )}

        {html && !loading && (
          <iframe
            srcDoc={html}
            sandbox="allow-same-origin"
            className="w-full border-0"
            style={{ minHeight: "100vh" }}
            title="Contenido de la fase"
          />
        )}
      </main>
    </div>
  );
}
