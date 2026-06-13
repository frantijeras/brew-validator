"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Download, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { renderMarkdown } from "@/components/markdown-renderer";

/**
 * Subpágina de contenido IN-APP (sin modal ni pestaña nueva). Sustituye al
 * antiguo `ContentViewerModal` (iframe blanco que rompía el diseño y parecía un
 * PDF). Sigue la MISMA lógica de navegación que la Fase 1 (Validación): al
 * pulsar "Ver" se reemplaza la lista de fases por este panel, con un botón
 * "← Volver" para regresar.
 *
 * Dos modos de render:
 *  - `markdown`: hace fetch de un endpoint JSON `{ content, contentType }` y lo
 *    renderiza inline con `renderMarkdown` en modo oscuro (`prose-invert`), de
 *    modo que las tablas y elementos respetan el tema de la app.
 *  - `frames`: para documentos HTML autónomos (maqueta, guía de estilo, rejilla
 *    de logos), que tienen su propio diseño. Se muestran enmarcados en el panel
 *    oscuro y, cuando hay más de uno, separados mediante pestañas (Tabs) — p.ej.
 *    "Guía de Estilo" / "Maqueta" — para verlos de forma independiente.
 */

export interface FrameTab {
  id: string;
  label: string;
  /** URL del documento HTML autónomo a mostrar en el iframe. */
  url: string;
}

export type SubpageView =
  | {
      kind: "markdown";
      title: string;
      /** Endpoint JSON que devuelve `{ title?, content, contentType }`. */
      url: string;
      /** Descargas opcionales para el menú de cabecera. */
      downloads?: Array<{ label: string; href: string }>;
    }
  | {
      kind: "frames";
      title: string;
      tabs: FrameTab[];
      downloads?: Array<{ label: string; href: string }>;
    };

function triggerDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function MarkdownBody({ url }: { url: string }) {
  // `html`: markdown ya renderizado (a inyectar en el panel oscuro).
  // `doc`: documento HTML autónomo (a aislar en iframe para no romper estilos).
  const [html, setHtml] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtml(null);
    setDoc(null);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Error ${res.status}`);
        }
        const json = await res.json();
        const content: string = json.content ?? "";
        const contentType: string = json.contentType ?? "markdown";
        if (cancelled) return;
        if (contentType === "html") {
          // Documento HTML autónomo: aislarlo en un iframe para que sus
          // estilos no contaminen la app ni se rompa el layout.
          setDoc(content);
        } else {
          setHtml(renderMarkdown(content));
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error al cargar el contenido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  if (doc !== null) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-700 bg-white">
        <iframe
          srcDoc={doc}
          title="Contenido"
          className="h-[72vh] w-full border-0"
          sandbox="allow-same-origin allow-popups"
        />
      </div>
    );
  }

  return (
    <div
      className="markdown-body prose prose-invert prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html ?? "" }}
    />
  );
}

function FramesBody({ tabs }: { tabs: FrameTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="space-y-3">
      {tabs.length > 1 && (
        <div className="flex items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                t.id === current?.id
                  ? "bg-amber-500 text-slate-950"
                  : "border border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {current && (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-white">
          <iframe
            key={current.id}
            src={current.url}
            title={current.label}
            className="h-[72vh] w-full border-0"
            sandbox="allow-same-origin allow-popups"
          />
        </div>
      )}
    </div>
  );
}

export function ContentSubpage({
  view,
  onBack,
}: {
  view: SubpageView;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Cabecera de la subpágina: volver + título + descargas */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Volver
        </button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-white">
          {view.title}
        </h2>
        {view.downloads?.map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => triggerDownload(d.href)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-white"
          >
            <Download className="size-3.5" />
            {d.label}
          </button>
        ))}
        {view.kind === "frames" && view.tabs.length === 1 && (
          <a
            href={view.tabs[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-white"
          >
            <ExternalLink className="size-3.5" />
            Abrir
          </a>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        {view.kind === "markdown" ? (
          <MarkdownBody url={view.url} />
        ) : (
          <FramesBody tabs={view.tabs} />
        )}
      </div>
    </div>
  );
}
