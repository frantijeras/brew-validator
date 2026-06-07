"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { renderMarkdown } from "@/components/markdown-renderer";

interface ValidationReport {
  id: string;
  agentName: string;
  title: string;
  content: string;
  createdAt: string;
}

interface ValidationData {
  reports: ValidationReport[];
  score: number | null;
  verdict: string | null;
  ideaTitle: string;
  projectName: string;
}

const AGENT_LABELS: Record<string, string> = {
  advocate: "Defensor",
  skeptic: "Escéptico",
  judge: "Juez",
};

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
        <div className="px-6 py-6 space-y-6">
          {sortedReports.map((report) => {
            const label = AGENT_LABELS[report.agentName] || report.agentName;
            const htmlContent = renderMarkdown(report.content, undefined, true);

            return (
              <div key={report.id}>
                <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary inline-block" />
                  Reporte {label}
                </h2>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-foreground prose-p:text-foreground/85
                    prose-strong:text-foreground prose-a:text-primary
                    prose-li:text-foreground/85
                    [&_table]:w-full [&_table]:border-collapse
                    [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:bg-muted/50 [&_th]:text-xs [&_th]:font-semibold
                    [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm
                    [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4
                    [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3
                    [&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2
                    [&_p]:leading-relaxed [&_p]:mb-3
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4
                    [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                    [&_hr]:my-6 [&_hr]:border-border
                    [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                    [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-sm"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
