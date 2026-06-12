/**
 * IDENTITY sub-fase 3d — composición app-side de la maqueta + guía de estilo.
 *
 * La 3d consume:
 *  - el SVG del logotipo elegido en 3c (de `subStepHistory.logo`),
 *  - la variante de estilo visual elegida (A/B/C) del sub-paso `visual`.
 *
 * Y produce, SIN depender del agente:
 *  1. **Maqueta HTML** (`index.html`): la variante elegida con el logotipo SVG
 *     incrustado.
 *  2. **Guía de Estilo**: documenta colores (HEX), fuentes y dirección visual,
 *     con el logotipo SVG incrustado. Se ofrece como HTML autocontenible (para
 *     "Ver" y para generar el PDF en cliente con el SVG renderizado) y como
 *     markdown (para el PDF de servidor y el hand-off).
 *
 * El parseo es tolerante: el contenido viene de un agente.
 */

import {
  parseVisualArtifactContent,
  getVisualOption,
  extractMetaFromHtml,
  type VisualStyleGuide,
} from "@/lib/identity-visual";
import { getChosenLogoSvg } from "@/lib/identity-logo";

export type VisualVariant = "A" | "B" | "C";

export function normalizeVariant(v: string | null | undefined): VisualVariant {
  const up = (v || "A").toString().toUpperCase();
  return up === "B" || up === "C" ? (up as VisualVariant) : "A";
}

/** Forma mínima de fase que necesitan los helpers (evita acoplar a Prisma).
 *  Los campos JSON llegan como `unknown` (columnas JSON de Prisma) y se
 *  estrechan internamente de forma tolerante. */
export interface Phase3dLike {
  subStep: string | null;
  subStepChoice: string | null;
  subStepArtifact: unknown;
  subStepHistory: unknown;
}

/** SVG del logotipo elegido en 3c, leído desde `subStepHistory.logo`. */
export function resolveChosenLogoSvg(phase: Phase3dLike): string | null {
  const history =
    phase.subStepHistory && typeof phase.subStepHistory === "object"
      ? (phase.subStepHistory as Record<
          string,
          { choice?: string; artifact?: { content?: string } | null }
        >)
      : null;
  const logoEntry = history?.logo;
  if (!logoEntry) return null;
  return getChosenLogoSvg(logoEntry.artifact?.content, logoEntry.choice);
}

/** Contenido JSON del sub-paso visual (preferimos el artefacto actual, luego el historial). */
function resolveVisualContent(phase: Phase3dLike) {
  const currentArt = phase.subStepArtifact as { content?: string } | null;
  const fromCurrent = parseVisualArtifactContent(currentArt?.content);
  if (fromCurrent) return fromCurrent;
  const history =
    phase.subStepHistory && typeof phase.subStepHistory === "object"
      ? (phase.subStepHistory as Record<
          string,
          { artifact?: { content?: string } | null }
        >)
      : null;
  return parseVisualArtifactContent(history?.visual?.artifact?.content);
}

export interface Resolved3dAssets {
  variant: VisualVariant;
  option: VisualStyleGuide;
  logoSvg: string | null;
  /** Maqueta HTML elegida con el logotipo incrustado. */
  maquetaHtml: string;
  /** Guía de estilo autocontenible (HTML) con el logotipo incrustado. */
  styleGuideHtml: string;
  /** Guía de estilo en markdown (para PDF de servidor / hand-off). */
  styleGuideMarkdown: string;
  meta: VisualStyleGuide["meta"];
}

/**
 * Resuelve todos los assets 3d para una variante dada. Devuelve `null` si no
 * hay artefacto visual utilizable.
 */
export function resolve3dAssets(
  phase: Phase3dLike,
  variantInput: string | null | undefined,
  projectName: string
): Resolved3dAssets | null {
  const content = resolveVisualContent(phase);
  if (!content) return null;

  const variant = normalizeVariant(
    variantInput || phase.subStepChoice || "A"
  );
  const option = getVisualOption(content, variant);
  if (!option) return null;

  const logoSvg = resolveChosenLogoSvg(phase);

  // Meta robusta: la del agente o, si falta algún campo, la extraída del HTML.
  const fallback = extractMetaFromHtml(option.html);
  const meta = {
    name: option.meta?.name || `Estilo ${variant}`,
    primaryColor: option.meta?.primaryColor || fallback.primaryColor,
    secondaryColor: option.meta?.secondaryColor || fallback.secondaryColor,
    fontHeading: option.meta?.fontHeading || fallback.fontHeading,
    fontBody: option.meta?.fontBody || fallback.fontBody,
    mood: option.meta?.mood || fallback.mood,
  };

  const maquetaHtml = embedLogoInHtml(option.html, logoSvg);
  const styleGuideHtml = buildStyleGuideHtml({
    projectName,
    variant,
    meta,
    logoSvg,
  });
  const styleGuideMarkdown = buildStyleGuideMarkdown({
    projectName,
    variant,
    meta,
  });

  return {
    variant,
    option,
    logoSvg,
    maquetaHtml,
    styleGuideHtml,
    styleGuideMarkdown,
    meta,
  };
}

/* ------------------------------------------------------------------ */
/* Incrustación del logotipo en la maqueta                            */
/* ------------------------------------------------------------------ */

const LOGO_TOKENS = ["{{LOGO}}", "{{logo}}", "<!--LOGO-->", "<!-- LOGO -->", "[LOGO]"];

/**
 * Incrusta el SVG del logotipo en la maqueta HTML.
 *  1. Sustituye tokens de marcador habituales si existen.
 *  2. Si no hay marcador, inyecta una cabecera con el logo justo tras `<body>`.
 *
 * Si `logoSvg` es null, devuelve el HTML original sin tocar.
 */
export function embedLogoInHtml(
  html: string,
  logoSvg: string | null
): string {
  if (!logoSvg) return html;

  let replaced = false;
  let out = html;
  for (const token of LOGO_TOKENS) {
    if (out.includes(token)) {
      out = out.split(token).join(logoSvg);
      replaced = true;
    }
  }
  if (replaced) return out;

  const header = `<div data-injected-logo="1" style="display:flex;align-items:center;gap:12px;padding:14px 24px;border-bottom:1px solid rgba(0,0,0,0.08)"><span style="display:inline-flex;align-items:center;height:44px">${logoSvg}</span></div>`;

  // Inyectar tras la etiqueta <body ...> de apertura.
  const bodyOpen = out.match(/<body[^>]*>/i);
  if (bodyOpen && bodyOpen.index != null) {
    const at = bodyOpen.index + bodyOpen[0].length;
    return out.slice(0, at) + header + out.slice(at);
  }
  // Sin <body>: anteponer.
  return header + out;
}

/* ------------------------------------------------------------------ */
/* Guía de estilo (HTML autocontenible)                               */
/* ------------------------------------------------------------------ */

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildStyleGuideHtml(params: {
  projectName: string;
  variant: VisualVariant;
  meta: VisualStyleGuide["meta"];
  logoSvg: string | null;
}): string {
  const { projectName, variant, meta, logoSvg } = params;
  const swatch = (label: string, hex: string) => `
    <div style="display:flex;align-items:center;gap:10px">
      <span style="display:inline-block;width:44px;height:44px;border-radius:8px;border:1px solid #e2e8f0;background:${esc(
        hex
      )}"></span>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b">${esc(
          label
        )}</div>
        <div style="font-family:monospace;font-size:13px;color:#0f172a">${esc(
          hex
        )}</div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guía de Estilo — ${esc(projectName)}</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:#fff;padding:32px;max-width:840px;margin:0 auto}
  h1{font-size:26px;margin:0 0 4px}
  h2{font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin:28px 0 12px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
  .sub{color:#64748b;font-size:13px;margin:0 0 24px}
  .logo{display:inline-flex;align-items:center;height:64px;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
  .card{border:1px solid #e2e8f0;border-radius:10px;padding:16px}
  .label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-bottom:4px}
  .val{font-size:15px;font-weight:600}
</style>
</head>
<body>
  ${logoSvg ? `<div class="logo">${logoSvg}</div>` : ""}
  <h1>Guía de Estilo — ${esc(projectName)}</h1>
  <p class="sub">Variante de estilo visual: <strong>${esc(variant)}</strong>${
    meta.name ? ` · ${esc(meta.name)}` : ""
  }</p>

  <h2>Paleta de colores (HEX)</h2>
  <div class="grid">
    ${swatch("Primario", meta.primaryColor)}
    ${swatch("Secundario", meta.secondaryColor)}
  </div>

  <h2>Tipografía</h2>
  <div class="grid">
    <div class="card"><div class="label">Titulares</div><div class="val" style="font-family:'${esc(
      meta.fontHeading
    )}',system-ui,sans-serif">${esc(meta.fontHeading)}</div></div>
    <div class="card"><div class="label">Cuerpo</div><div class="val" style="font-family:'${esc(
      meta.fontBody
    )}',system-ui,sans-serif">${esc(meta.fontBody)}</div></div>
  </div>

  <h2>Dirección visual</h2>
  <div class="card">${esc(meta.mood) || "—"}</div>

  <h2>Logotipo</h2>
  <div class="card">
    ${
      logoSvg
        ? `<div style="display:inline-flex;align-items:center;height:72px">${logoSvg}</div>`
        : "Sin logotipo seleccionado."
    }
  </div>
</body>
</html>`;
}

export function buildStyleGuideMarkdown(params: {
  projectName: string;
  variant: VisualVariant;
  meta: VisualStyleGuide["meta"];
}): string {
  const { projectName, variant, meta } = params;
  return [
    `# Guía de Estilo — ${projectName}`,
    "",
    `Variante de estilo visual elegida: **${variant}**${
      meta.name ? ` (${meta.name})` : ""
    }.`,
    "",
    "## Paleta de colores (HEX, Sistema hexadecimal)",
    `- **Primario:** ${meta.primaryColor}`,
    `- **Secundario:** ${meta.secondaryColor}`,
    "",
    "## Tipografía",
    `- **Titulares:** ${meta.fontHeading}`,
    `- **Cuerpo:** ${meta.fontBody}`,
    "",
    "## Dirección visual",
    meta.mood || "—",
    "",
    "> El logotipo en SVG (Gráficos vectoriales redimensionables) se entrega",
    "> incrustado en la maqueta `index.html` y como `logo.svg` en el hand-off.",
    "",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Vista integrada (guía + maqueta) para el botón "Ver"               */
/* ------------------------------------------------------------------ */

/**
 * HTML que muestra, en una sola página y sin romper el layout, la Guía de
 * Estilo y la maqueta una junto a otra, cada una aislada en su iframe
 * (`srcdoc`) para que sus estilos no colisionen.
 */
export function buildIntegratedViewHtml(params: {
  projectName: string;
  variant: VisualVariant;
  maquetaHtml: string;
  styleGuideHtml: string;
}): string {
  const { projectName, variant, maquetaHtml, styleGuideHtml } = params;
  const srcdoc = (html: string) => esc(html);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>3d — ${esc(projectName)} (${esc(variant)})</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
  header{padding:14px 20px;border-bottom:1px solid #1e293b}
  header h1{font-size:16px;margin:0}
  .wrap{display:grid;grid-template-columns:1fr 1fr;gap:0;min-height:calc(100vh - 50px)}
  @media(max-width:900px){.wrap{grid-template-columns:1fr}}
  .pane{display:flex;flex-direction:column;border-right:1px solid #1e293b}
  .pane h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0;padding:10px 16px;background:#111827;border-bottom:1px solid #1e293b}
  iframe{flex:1;width:100%;border:0;background:#fff;min-height:70vh}
</style>
</head>
<body>
  <header><h1>Estilo Visual y Maqueta (3d) — ${esc(projectName)} · Variante ${esc(
    variant
  )}</h1></header>
  <div class="wrap">
    <div class="pane">
      <h2>Guía de Estilo</h2>
      <iframe sandbox="allow-same-origin" srcdoc="${srcdoc(styleGuideHtml)}"></iframe>
    </div>
    <div class="pane" style="border-right:0">
      <h2>Maqueta (con logotipo)</h2>
      <iframe sandbox="allow-same-origin" srcdoc="${srcdoc(maquetaHtml)}"></iframe>
    </div>
  </div>
</body>
</html>`;
}
