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
export function numberLogoHtml(html: string | null | undefined): string {
  if (!html || typeof html !== "string") return html || "";
  let n = 0;
  const badge = (i: number) =>
    `<span style="display:inline-flex;align-items:center;justify-content:center;` +
    `width:22px;height:22px;border-radius:6px;background:#0f172a;color:#fff;` +
    `font:700 12px system-ui,sans-serif;margin:0 6px 6px 0">${i}</span>`;
  return html.replace(/<svg/gi, () => {
    n += 1;
    return badge(n) + "<svg";
  });
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
