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
import { BRAND_HEX } from "@/lib/brand-colors";

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
  const primary = meta.primaryColor;
  const secondary = meta.secondaryColor;
  const heading = meta.fontHeading;
  const body = meta.fontBody;
  // Neutros de marca centralizados (coherentes con los tokens de la app).
  const neutralDark = BRAND_HEX.neutralDark;
  const neutralLight = BRAND_HEX.neutralLight;

  // Fuentes de Google (best-effort): si las fuentes existen en Google Fonts se
  // cargan; si no, se cae al fallback del sistema sin romper nada.
  const fontParam = (f: string) => f.trim().replace(/\s+/g, "+");
  const fontsHref = `https://fonts.googleapis.com/css2?family=${fontParam(
    heading
  )}:wght@400;600;700;800&family=${fontParam(body)}:wght@400;500;600&display=swap`;

  const swatch = (label: string, hex: string, usage: string) => `
    <div class="swatch">
      <span class="chip" style="background:${esc(hex)}"></span>
      <div class="chip-meta">
        <div class="lbl">${esc(label)}</div>
        <div class="hex">${esc(hex)}</div>
        <div class="usage">${esc(usage)}</div>
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="mood" content="${esc(meta.mood)}">
<title>Guía de Estilo — ${esc(projectName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(fontsHref)}">
<style>
  :root{
    --brand-primary:${esc(primary)};
    --brand-secondary:${esc(secondary)};
    --neutral-dark:${neutralDark};
    --neutral-light:${neutralLight};
    --font-heading:'${esc(heading)}',system-ui,-apple-system,"Segoe UI",sans-serif;
    --font-body:'${esc(body)}',system-ui,-apple-system,"Segoe UI",sans-serif;
    --radius:12px;
    --line:#e7eaf0;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--font-body);color:#1e293b;background:#fff;line-height:1.55}
  .page{max-width:900px;margin:0 auto;padding:40px 32px 80px}
  .cover{display:flex;align-items:center;gap:18px;padding:28px;border-radius:var(--radius);
    background:linear-gradient(135deg,var(--brand-primary),var(--brand-secondary));color:#fff;margin-bottom:8px}
  .cover .logo{display:inline-flex;align-items:center;height:60px;max-width:200px;background:rgba(255,255,255,.12);
    border-radius:10px;padding:8px 14px}
  .cover h1{font-family:var(--font-heading);font-size:30px;font-weight:800;margin:0;letter-spacing:-.01em}
  .cover .tag{margin-top:4px;font-size:13px;opacity:.92}
  section{margin-top:40px}
  h2{font-family:var(--font-heading);font-size:13px;font-weight:700;text-transform:uppercase;
    letter-spacing:.08em;color:var(--brand-primary);margin:0 0 16px;display:flex;align-items:center;gap:8px}
  h2::before{content:"";width:18px;height:3px;border-radius:2px;background:var(--brand-secondary)}
  p.lead{color:#64748b;font-size:14px;margin:0 0 24px;max-width:60ch}
  .grid{display:grid;gap:16px}
  .cols-2{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
  .cols-3{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
  .card{border:1px solid var(--line);border-radius:var(--radius);padding:18px;background:#fff}
  /* Paleta */
  .swatch{display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:var(--radius);padding:14px}
  .chip{width:56px;height:56px;border-radius:10px;border:1px solid rgba(0,0,0,.06);flex:none}
  .chip-meta .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:600}
  .chip-meta .hex{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;color:#0f172a;font-weight:600}
  .chip-meta .usage{font-size:12px;color:#64748b;margin-top:2px;max-width:30ch}
  /* Tipografía */
  .type-row{border:1px solid var(--line);border-radius:var(--radius);padding:18px;margin-bottom:12px}
  .type-row .meta{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin-bottom:8px;font-weight:600}
  .h1-demo{font-family:var(--font-heading);font-size:34px;font-weight:800;line-height:1.1;margin:0;color:#0f172a}
  .h2-demo{font-family:var(--font-heading);font-size:24px;font-weight:700;margin:0;color:#0f172a}
  .h3-demo{font-family:var(--font-heading);font-size:18px;font-weight:600;margin:0;color:#0f172a}
  .body-demo{font-family:var(--font-body);font-size:16px;margin:0;color:#334155}
  .small-demo{font-family:var(--font-body);font-size:13px;margin:0;color:#64748b}
  /* Espaciado */
  .space-item{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  .space-bar{height:14px;border-radius:4px;background:var(--brand-secondary);opacity:.8}
  .space-item code{font-family:ui-monospace,monospace;font-size:12px;color:#475569}
  /* Componentes */
  .btn{display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-body);
    font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px;border:1px solid transparent;cursor:default}
  .btn-primary{background:var(--brand-primary);color:#fff}
  .btn-secondary{background:var(--brand-secondary);color:#0f172a}
  .btn-ghost{background:transparent;color:var(--brand-primary);border-color:var(--brand-primary)}
  .input-demo{display:block;width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;
    font-family:var(--font-body);font-size:14px;color:#0f172a;background:#fff;margin-top:8px}
  .badge{display:inline-flex;align-items:center;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px}
  .badge-p{background:color-mix(in srgb,var(--brand-primary) 14%,#fff);color:var(--brand-primary)}
  .badge-s{background:color-mix(in srgb,var(--brand-secondary) 20%,#fff);color:#0f172a}
  /* Do / Don't */
  .rules{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:640px){.rules{grid-template-columns:1fr}}
  .rule{border-radius:var(--radius);padding:16px;border:1px solid var(--line)}
  .rule.do{border-color:#bbf7d0;background:#f0fdf4}
  .rule.dont{border-color:#fecaca;background:#fef2f2}
  .rule h3{margin:0 0 8px;font-size:13px;font-family:var(--font-heading)}
  .rule.do h3{color:#15803d}
  .rule.dont h3{color:#b91c1c}
  .rule ul{margin:0;padding-left:18px;font-size:13px;color:#475569}
  .rule li{margin-bottom:4px}
  .logo-box{display:flex;flex-wrap:wrap;gap:16px}
  .logo-frame{border:1px solid var(--line);border-radius:var(--radius);padding:20px;display:flex;
    align-items:center;justify-content:center;min-width:160px;min-height:120px}
  .logo-frame.dark{background:var(--neutral-dark)}
  .logo-frame svg{max-width:160px;max-height:80px;height:auto}
</style>
</head>
<body>
  <div class="page">
    <div class="cover">
      ${logoSvg ? `<span class="logo">${logoSvg}</span>` : ""}
      <div>
        <h1>${esc(projectName)}</h1>
        <div class="tag">Guía de Estilo · Variante ${esc(variant)}${
          meta.name ? ` — ${esc(meta.name)}` : ""
        }</div>
      </div>
    </div>
    <p class="lead">${
      esc(meta.mood) ||
      "Sistema visual de la marca para aplicarlo de forma coherente en web, redes, presentaciones y cualquier material."
    }</p>

    <section>
      <h2>Paleta de colores</h2>
      <p class="lead">Usa el primario para acciones y acentos clave; el secundario para apoyo y contraste; los neutros para texto y fondos. Mantén un contraste mínimo AA (4.5:1).</p>
      <div class="grid cols-2">
        ${swatch("Primario", primary, "CTAs, enlaces, acentos de marca")}
        ${swatch("Secundario", secondary, "Apoyo, destacados, fondos de sección")}
        ${swatch("Neutro oscuro", neutralDark, "Texto principal, fondos dark")}
        ${swatch("Neutro claro", neutralLight, "Fondos, superficies, separadores")}
      </div>
    </section>

    <section>
      <h2>Tipografía</h2>
      <p class="lead">Titulares en <strong>${esc(heading)}</strong>, cuerpo en <strong>${esc(
        body
      )}</strong>. No mezcles más de estas dos familias.</p>
      <div class="type-row">
        <div class="meta">H1 · ${esc(heading)} · 34px / 800</div>
        <p class="h1-demo">${esc(projectName)}</p>
      </div>
      <div class="type-row">
        <div class="meta">H2 · ${esc(heading)} · 24px / 700</div>
        <p class="h2-demo">Titular de sección</p>
      </div>
      <div class="type-row">
        <div class="meta">H3 · ${esc(heading)} · 18px / 600</div>
        <p class="h3-demo">Subtítulo o etiqueta</p>
      </div>
      <div class="type-row">
        <div class="meta">Cuerpo · ${esc(body)} · 16px / 400</div>
        <p class="body-demo">Texto de párrafo para contenido extenso. Pensado para una lectura cómoda con un interlineado de 1.55.</p>
        <p class="small-demo">Texto pequeño / notas · 13px</p>
      </div>
    </section>

    <section>
      <h2>Sistema de espaciado</h2>
      <p class="lead">Escala base de 4px. Usa múltiplos para márgenes, paddings y gaps de forma consistente.</p>
      <div class="card">
        ${[4, 8, 12, 16, 24, 32, 48]
          .map(
            (n) =>
              `<div class="space-item"><span class="space-bar" style="width:${n * 3}px"></span><code>${n}px</code></div>`
          )
          .join("")}
      </div>
    </section>

    <section>
      <h2>Componentes</h2>
      <div class="grid cols-2">
        <div class="card">
          <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:600;margin-bottom:12px">Botones</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            <span class="btn btn-primary">Primario</span>
            <span class="btn btn-secondary">Secundario</span>
            <span class="btn btn-ghost">Ghost</span>
          </div>
        </div>
        <div class="card">
          <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:600;margin-bottom:12px">Badges</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            <span class="badge badge-p">Etiqueta</span>
            <span class="badge badge-s">Destacado</span>
          </div>
        </div>
        <div class="card">
          <div class="meta" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:600">Campo de formulario</div>
          <input class="input-demo" value="Texto de ejemplo" readonly>
        </div>
        <div class="card" style="border-top:3px solid var(--brand-primary)">
          <div class="h3-demo" style="font-size:16px">Tarjeta</div>
          <p class="small-demo" style="margin-top:6px">Superficie con borde sutil, radio ${"12px"} y acento superior opcional.</p>
        </div>
      </div>
    </section>

    <section>
      <h2>Buenas prácticas</h2>
      <div class="rules">
        <div class="rule do">
          <h3>✓ Sí</h3>
          <ul>
            <li>Respeta la paleta y la jerarquía tipográfica.</li>
            <li>Deja aire alrededor del logotipo (área de respeto).</li>
            <li>Garantiza contraste AA en texto sobre fondo.</li>
            <li>Usa el secundario con moderación, como acento.</li>
          </ul>
        </div>
        <div class="rule dont">
          <h3>✕ No</h3>
          <ul>
            <li>No mezcles más de dos familias tipográficas.</li>
            <li>No deformes, rotes ni recolorees el logotipo.</li>
            <li>No satures la composición de colores de marca.</li>
            <li>No uses el primario como fondo de texto largo.</li>
          </ul>
        </div>
      </div>
    </section>

    <section>
      <h2>Logotipo</h2>
      <p class="lead">Se entrega como <code>assets/logo.svg</code> (vectorial, escalable sin pérdida). Funciona sobre fondo claro y oscuro.</p>
      <div class="logo-box">
        <div class="logo-frame">${logoSvg || "Sin logotipo"}</div>
        <div class="logo-frame dark">${logoSvg || "Sin logotipo"}</div>
      </div>
    </section>
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
    `# Guia de Estilo - ${projectName}`,
    "",
    `Variante de estilo visual elegida: **${variant}**${meta.name ? ` (${meta.name})` : ""}.`,
    "Esta guia documenta la identidad visual para aplicarla de forma coherente en",
    "web, redes, presentaciones y cualquier material de marca.",
    "",
    "## 1. Paleta de colores (HEX, Sistema hexadecimal)",
    "",
    "| Rol | Color | Uso recomendado |",
    "|---|---|---|",
    `| Primario | \`${meta.primaryColor}\` | Color principal de marca: CTAs, enlaces, acentos clave. |`,
    `| Secundario | \`${meta.secondaryColor}\` | Apoyo y contraste: fondos de seccion, destacados secundarios. |`,
    "| Neutros | #0F172A / #F8FAFC | Texto y fondos. Usar neutros oscuros sobre claros para legibilidad. |",
    "",
    "**Regla de contraste:** garantiza un ratio AA (4.5:1) entre texto y fondo.",
    "",
    "## 2. Tipografia",
    "",
    `- **Titulares:** ${meta.fontHeading} - usar para H1-H3, peso bold, tracking ajustado.`,
    `- **Cuerpo:** ${meta.fontBody} - usar para parrafos y UI, peso regular, line-height 1.5.`,
    "",
    "**Escala sugerida:** H1 32px / H2 24px / H3 18px / cuerpo 16px / nota 13px.",
    "",
    "## 3. Direccion visual",
    "",
    meta.mood || "Estilo limpio y coherente con el target del proyecto.",
    "",
    "## 4. Logotipo",
    "",
    "- Se entrega como `assets/logo.svg` (vectorial, escalable sin perdida).",
    "- Mantener un area de respeto alrededor equivalente a la altura de su simbolo.",
    "- No deformar, rotar ni recolorear fuera de la paleta definida.",
    "",
    "## 5. Aplicaciones",
    "",
    "- **Web/Landing:** ver maqueta en `assets/maqueta.html` (con el logotipo incrustado).",
    "- **Redes:** usar primario en avatares y secundario en portadas.",
    "- **Documentos:** titulares con la fuente de titulares, cuerpo con la de cuerpo.",
    "",
    "## 6. Buenas practicas (SI / NO)",
    "",
    "- SI: respetar la paleta, mantener jerarquia tipografica, dejar aire alrededor del logo.",
    "- NO: mezclar mas de 2 fuentes, saturar de colores, comprimir o estirar el logotipo.",
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
  // El valor de `srcdoc="..."` es un atributo HTML: hay que escapar TAMBIÉN las
  // comillas dobles (la maqueta/guía las contienen) o el atributo se rompe y el
  // iframe sale en blanco ("no se ve nada al darle Ver" en 3d).
  const srcdoc = (html: string) => esc(html).replace(/"/g, "&quot;");
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
