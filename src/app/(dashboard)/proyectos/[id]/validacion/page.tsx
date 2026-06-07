"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { ReportViewer } from "@/components/report-viewer";

interface ValidationReport {
  id: string;
  agentName: string;
  title: string;
  content: string;
  createdAt: string;
  scorecard: string | null;
  verdict: string | null;
}

interface ValidationData {
  reports: ValidationReport[];
  score: number | null;
  verdict: string | null;
  ideaTitle: string;
  projectName: string;
}

const AGENT_ORDER = ["advocate", "skeptic", "judge"];

export default function ValidationViewPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ValidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${params.id}/validation/view?format=json`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error ||
              (res.status === 404
                ? "No hay validación disponible"
                : "Error al cargar la validación")
          );
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Error al cargar la validación"
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
  }, [params.id]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error ──
  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Link
          href={`/proyectos/${params.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Volver al proyecto
        </Link>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center">
          <p className="text-destructive font-medium">
            {error || "No se pudo cargar la validación"}
          </p>
        </div>
      </div>
    );
  }

  // Sort reports: advocate, skeptic, judge
  const sortedReports = AGENT_ORDER
    .map((agent) => data.reports.find((r) => r.agentName === agent))
    .filter(Boolean) as ValidationReport[];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header row: breadcrumb + download button */}
      <div className="flex justify-between items-center mb-6">
        <Link
          href={`/proyectos/${params.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
          Volver al proyecto
        </Link>

        <a
          href={`/api/projects/${params.id}/validation/download`}
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          download
        >
          <Download className="size-4" />
          Descargar PDF
        </a>
      </div>

      {/* Main card */}
      <div className="bg-card border rounded-xl shadow-sm">
        {/* Card header: title, score, verdict */}
        <div className="px-6 py-4 border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{data.ideaTitle}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Validación de Idea
              </p>
            </div>
            <div className="flex items-center gap-3">
              {data.score !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                  Score: {data.score.toFixed(1)}
                </span>
              )}
              {data.verdict && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    data.verdict === "VIABLE"
                      ? "bg-green-500/10 text-green-400"
                      : data.verdict === "NO_VIABLE"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  Veredicto:{" "}
                  {data.verdict === "VIABLE"
                    ? "VIABLE"
                    : data.verdict === "NO_VIABLE"
                      ? "NO VIABLE"
                      : "PULIR IDEA"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card body: reports */}
        <div className="px-6 py-6 space-y-4">
          {sortedReports.map((report) => (
            <ReportViewer
              key={report.id}
              report={{
                id: report.id,
                title: report.title,
                agentName: report.agentName,
                content: report.content,
                scorecard: report.scorecard,
                verdict: report.verdict,
                createdAt: report.createdAt,
              }}
              defaultOpen={report.agentName === "judge"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
