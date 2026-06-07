"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { renderMarkdown } from "@/components/markdown-renderer";

interface PhaseContent {
  title: string;
  content: string;
  contentType: string;
}

export default function PhaseViewPage() {
  const params = useParams<{ id: string; phaseId: string }>();
  const [data, setData] = useState<PhaseContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${params.id}/phases/${params.phaseId}/content`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error ||
              (res.status === 404
                ? "Fase no encontrada"
                : "Error al cargar el contenido")
          );
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
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
  }, [params.id, params.phaseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            {error || "No se pudo cargar el informe"}
          </p>
        </div>
      </div>
    );
  }

  const htmlContent =
    data.contentType === "html" ? data.content : renderMarkdown(data.content);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <Link
        href={`/proyectos/${params.id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
      >
        <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
        Volver al proyecto
      </Link>

      {/* Report content */}
      <div className="bg-card border rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b">
          <h1 className="text-xl font-semibold">{data.title}</h1>
        </div>
        <div className="px-6 py-6">
          {data.contentType === "html" ? (
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
