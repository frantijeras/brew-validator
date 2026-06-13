/**
 * IDENTITY `logo` (sub-fase 3c) helpers.
 *
 * El agente `project-branding` emite, en el sub-paso `logo`, un único
 * documento HTML renderizable con 12 propuestas de logotipo en SVG
 * (Gráficos vectoriales redimensionables), una por `.logo-card`. El usuario
 * elige una (índice 1..12) en el modal.
 *
 * Estas utilidades extraen los SVG individuales del HTML para:
 *  - mostrar el número de propuestas en la UI,
 *  - recuperar el SVG elegido y incrustarlo en la maqueta 3d (preview.html),
 *  - empaquetar `logos-options.svg` / el SVG elegido en el hand-off.
 *
 * El parseo es deliberadamente tolerante (regex sobre el HTML) porque el
 * contenido viene de un agente y no de un DOM de confianza. Asumimos SVG no
 * anidados (cada logo es un `<svg>…</svg>` de primer nivel), que es justo lo
 * que exige el prompt de la skill.
 */

const SVG_BLOCK_RE = /<svg[\s\S]*?<\/svg>/gi;

/** Devuelve todos los bloques `<svg>…</svg>` del HTML, en orden de aparición. */
export function extractLogoSvgs(html: string | null | undefined): string[] {
  if (!html || typeof html !== "string") return [];
  const matches = html.match(SVG_BLOCK_RE);
  return matches ? matches.map((s) => s.trim()) : [];
}

/** Número de logos (bloques SVG) presentes en el HTML. */
export function countLogos(html: string | null | undefined): number {
  return extractLogoSvgs(html).length;
}

/**
 * Inyecta un badge numerado (1, 2, 3…) antes de cada `<svg>` para que el
 * usuario pueda identificar cada propuesta y elegirla con su número. Como el
 * HTML se muestra en un iframe sin scripts (`sandbox=allow-same-origin`), la
 * numeración debe ser ESTÁTICA en el markup, no por JavaScript.
 */
export function numberLogoHtml(
  html: string | null | undefined,
  selected?: number | null,
): string {
  if (!html || typeof html !== "string") return html || "";
  let n = 0;
  const badge = (i: number) => {
    const isSel = selected != null && i === selected;
    if (isSel) {
      // Logo elegido: badge ámbar con check y etiqueta, para que se vea de un
      // vistazo cuál fue la decisión entre las 12 propuestas.
      return (
        `<span style="display:inline-flex;align-items:center;justify-content:center;gap:4px;` +
        `height:22px;padding:0 8px;border-radius:6px;background:#f59e0b;color:#0f172a;` +
        `font:700 12px system-ui,sans-serif;margin:0 6px 6px 0">&#10003; ${i} · Elegido</span>`
      );
    }
    return (
      `<span style="display:inline-flex;align-items:center;justify-content:center;` +
      `width:22px;height:22px;border-radius:6px;background:#0f172a;color:#fff;` +
      `font:700 12px system-ui,sans-serif;margin:0 6px 6px 0">${i}</span>`
    );
  };
  const numbered = html.replace(/<svg/gi, () => {
    n += 1;
    return badge(n) + "<svg";
  });
  return enforceSquareLogoCanvas(numbered);
}

/**
 * Fuerza que TODOS los logos/imagotipos se rendericen dentro de un lienzo
 * cuadrado (proporción 1:1), inyectando un `<style>` que aplica
 * `aspect-ratio:1/1` a cada `<svg>`. Refuerza, desde el contenedor, la misma
 * regla que el prompt exige al agente (viewBox cuadrado). Es idempotente.
 */
export function enforceSquareLogoCanvas(html: string): string {
  if (html.includes("brew-logo-1x1")) return html;
  const style =
    `<style id="brew-logo-1x1">` +
    `svg{aspect-ratio:1/1!important;width:100%!important;height:auto!important;` +
    `max-width:220px;display:block;margin:0 auto;object-fit:contain}` +
    `</style>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${style}</head>`);
  }
  const bodyOpen = html.match(/<body[^>]*>/i);
  if (bodyOpen && bodyOpen.index != null) {
    const at = bodyOpen.index + bodyOpen[0].length;
    return html.slice(0, at) + style + html.slice(at);
  }
  return style + html;
}

/**
 * Recupera el SVG elegido. `choice` puede ser:
 *  - un índice 1-based ("1".."12" o number),
 *  - o un identificador "logo-N".
 * Devuelve `null` si no se puede resolver.
 */
export function getChosenLogoSvg(
  html: string | null | undefined,
  choice: string | number | null | undefined
): string | null {
  const svgs = extractLogoSvgs(html);
  if (svgs.length === 0) return null;
  const idx = parseLogoIndex(choice);
  if (idx == null) return svgs[0] ?? null; // fallback: primer logo
  // idx es 1-based
  return svgs[idx - 1] ?? null;
}

/** Tokens de marcador que el template del agente puede usar para el logotipo. */
export const LOGO_TOKENS = [
  "{{LOGO}}",
  "{{logo}}",
  "<!--LOGO-->",
  "<!-- LOGO -->",
  "[LOGO]",
];

/**
 * Incrusta el SVG del logotipo en un HTML.
 *  1. Sustituye los tokens de marcador (`{{LOGO}}`, `[LOGO]`, …) si existen.
 *  2. Si no hay marcador, inyecta una cabecera con el logo tras `<body>`.
 *
 * Función pura (sin dependencias de servidor): se usa tanto al componer la
 * maqueta 3d server-side como al previsualizar las 3 muestras en el cliente
 * (para que el usuario vea su logotipo ya colocado al elegir el estilo).
 * Si `logoSvg` es null, devuelve el HTML original sin tocar.
 */
export function embedLogoInHtml(html: string, logoSvg: string | null): string {
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
  const bodyOpen = out.match(/<body[^>]*>/i);
  if (bodyOpen && bodyOpen.index != null) {
    const at = bodyOpen.index + bodyOpen[0].length;
    return out.slice(0, at) + header + out.slice(at);
  }
  return header + out;
}

/** Normaliza una elección de logo a un índice 1-based, o null. */
export function parseLogoIndex(
  choice: string | number | null | undefined
): number | null {
  if (choice == null) return null;
  if (typeof choice === "number") {
    return Number.isFinite(choice) && choice >= 1 ? Math.floor(choice) : null;
  }
  const m = String(choice).match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}
