"use client";

import { useEffect, useState } from "react";

type BuildInfo = {
  sha: string;
  shortSha: string;
  message: string;
  branch: string;
  environment: string;
  deployedAt: string;
};

/**
 * Badge discreto en la esquina inferior del sidebar que muestra el hash
 * corto del commit actual. En hover muestra SHA completo, mensaje, branch
 * y entorno vía el atributo `title` (tooltips nativos, sin librería extra).
 *
 * - En Vercel → muestra el SHA real (p.ej. "a1b2c3d")
 * - En local  → muestra "dev local"
 * - Si falla  → muestra "build ?" en gris
 */
export function BuildInfoBadge() {
  const [info, setInfo] = useState<BuildInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/build-info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: BuildInfo) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Loading → no mostrar nada
  if (!info && !failed) return null;

  // Fallo de fetch
  if (failed || !info) {
    return (
      <footer className="mt-auto px-4 py-3 border-t border-slate-800">
        <div
          className="text-[10px] text-slate-600 font-mono flex items-center gap-1.5"
          title="No se pudo obtener la información de build"
        >
          <span
            className="size-1.5 rounded-full bg-slate-600"
            aria-hidden
          />
          <span>build ?</span>
        </div>
      </footer>
    );
  }

  const isLocal = info.sha === "local";
  const fullTooltip = isLocal
    ? `Desarrollo local\n${info.environment}\nÚltima actualización: ${info.deployedAt}`
    : `Commit ${info.sha}\n${info.message}\n${info.branch} · ${info.environment}\nDeployed: ${info.deployedAt}`;

  return (
    <footer className="mt-auto px-4 py-3 border-t border-slate-800">
      <div
        className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5"
        title={fullTooltip}
      >
        <span
          className="size-1.5 rounded-full bg-emerald-500"
          aria-hidden
        />
        <span>{isLocal ? "dev local" : info.shortSha}</span>
        {!isLocal && info.branch !== "local" && (
          <span className="text-slate-600">·</span>
        )}
        {!isLocal && info.branch !== "local" && (
          <span className="text-slate-600">{info.branch}</span>
        )}
      </div>
    </footer>
  );
}
