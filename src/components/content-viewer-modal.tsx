"use client";

import * as React from "react";
import { X, ExternalLink, Loader2 } from "lucide-react";

/**
 * Visor de contenido IN-APP (sin abrir pestaña nueva). Muestra el HTML que
 * devuelve un endpoint de "Ver" dentro de un iframe, enmarcado con el estilo
 * oscuro de la app — consistente para TODAS las fases y sub-fases. El contenido
 * (markdown renderizado, rejilla de logos, vista 3d integrada) se aísla en el
 * iframe para que sus estilos no rompan la pantalla.
 */
export function ContentViewerModal({
  open,
  title,
  url,
  onClose,
}: {
  open: boolean;
  title: string;
  url: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (open) setLoading(true);
  }, [open, url]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
          <div className="flex items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir en pestaña nueva"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <ExternalLink className="size-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="relative flex-1 bg-white">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70">
              <Loader2 className="size-6 animate-spin text-amber-400" />
            </div>
          )}
          <iframe
            src={url}
            title={title}
            className="h-full w-full border-0"
            sandbox="allow-same-origin allow-popups"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}
