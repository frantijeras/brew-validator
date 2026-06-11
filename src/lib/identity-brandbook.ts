/**
 * IDENTITY phase — Brand Book consolidator (sub-step `final`).
 *
 * The `final` sub-step of the IDENTITY phase generates a consolidated
 * Brand Book from the outputs of the three preceding sub-steps:
 *   naming (name + rationale), voice (tone of voice), visual (style guide).
 *
 * `buildBrandBook` takes the raw artifacts from all three sub-steps and
 * assembles a structured `BrandBook` with 9 canonical sections. The
 * frontend uses this structure to render a two-panel view (index + content)
 * and the endpoints serve the assembled markdown as standalone HTML/PDF.
 *
 * IMPORTANT: keep the section list (`BRANDBOOK_DEFAULT_SECTIONS`) in sync
 * with the `project-branding` agent contract documented in the identity spec.
 */

import { parseVisualArtifactContent, type VisualStyleGuide } from "./identity-visual";

/* ── Types ──────────────────────────────────────────────────────────── */

/** One section of the Brand Book (rendered as a markdown segment). */
export interface BrandBookSection {
  /** Stable id used as anchor and for the index list. */
  id: string;
  /** Human-friendly title shown in the index sidebar. */
  title: string;
  /** Markdown content of the section. */
  content: string;
  /** Sorting order (0 = first). */
  order: number;
}

/** Metadata block that summarizes the visual identity choices. */
export interface BrandBookVisualMeta {
  /** Which variant was chosen: A, B or C. */
  variant: "A" | "B" | "C";
  /** Human-friendly name, e.g. "Estilo A — Moderno y vibrante". */
  name: string;
  /** Primary brand color (hex). */
  primaryColor: string;
  /** Secondary brand color (hex). */
  secondaryColor: string;
  /** Heading font family name. */
  fontHeading: string;
  /** Body font family name. */
  fontBody: string;
  /** Short mood description. */
  mood: string;
}

/** Brand Book — the output of the `final` sub-step. */
export interface BrandBook {
  /** Project display name (set via the naming sub-step or kept from creation). */
  projectName: string;
  /** ISO 8601 timestamp of when the Brand Book was generated. */
  generatedAt: string;
  /** Ordered list of sections (markdown). */
  sections: BrandBookSection[];
  /** Metadata pulled from the sub-step artifacts. */
  meta: {
    /** Extracted naming rationale (short excerpt). */
    namingRationale?: string;
    /** Voice & tone summary (first ~800 chars). */
    voiceSummary: string;
    /** Visual style metadata, if a style was chosen. */
    visualMeta: BrandBookVisualMeta | null;
  };
}

/* ── Default section list ───────────────────────────────────────────── */

/**
 * Canonical section ids and titles for the Brand Book. Order is
 * significant: the sidebar index follows this sequence.
 *
 * Sections whose content is derived from sub-step outputs (naming,
 * voice, logo, color, typography, imagery, applications, dosdonts) get
 * populated by `buildBrandBook`. Sections like `intro` are generated
 * from the project description / context.
 */
export const BRANDBOOK_DEFAULT_SECTIONS: Array<{
  id: string;
  title: string;
  order: number;
}> = [
  { id: "intro",        title: "Introducción",            order: 0 },
  { id: "naming",       title: "Nombre y rationale",      order: 1 },
  { id: "logo",         title: "Logo y uso",              order: 2 },
  { id: "color",        title: "Paleta de colores",       order: 3 },
  { id: "typography",   title: "Tipografía",              order: 4 },
  { id: "voice",        title: "Voz y tono",              order: 5 },
  { id: "imagery",      title: "Estilo visual",           order: 6 },
  { id: "applications", title: "Ejemplos de aplicación",  order: 7 },
  { id: "dosdonts",     title: "Do's & Don'ts",           order: 8 },
];

/* ── Helpers ────────────────────────────────────────────────────────── */

/**
 * Extract a naming rationale from the naming artifact content by scanning
 * for paragraphs that contain rationale keywords. Returns the best match
 * or falls back to the first non-empty text block.
 */
function extractNamingRationale(content: string | null): string {
  if (!content) return "";
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Look for sentences with rationale keywords.
  const rationaleKeywords = /\b(porque|elegimos|decidimos|razón|motivo|justificó)\b/i;
  for (const p of paragraphs) {
    if (rationaleKeywords.test(p)) {
      // Return the paragraph, but cap at a reasonable length.
      return p.length > 600 ? p.slice(0, 600) + "…" : p;
    }
  }

  // Fallback: first paragraph up to 600 chars.
  const first = paragraphs[0];
  if (first) {
    return first.length > 600 ? first.slice(0, 600) + "…" : first;
  }
  return "";
}

/**
 * Extract a voice & tone summary from the voice artifact content.
 * Takes up to the first 800 characters to produce a compact summary.
 */
function extractVoiceSummary(content: string | null): string {
  if (!content) return "";
  const cleaned = content.trim();
  if (cleaned.length <= 800) return cleaned;
  // Try to break at a paragraph boundary within 800 chars.
  const excerpt = cleaned.slice(0, 800);
  const lastBreak = Math.max(
    excerpt.lastIndexOf("\n\n"),
    excerpt.lastIndexOf(". "),
    excerpt.lastIndexOf(".\n")
  );
  if (lastBreak > 400) return excerpt.slice(0, lastBreak + 1).trim();
  return excerpt + "…";
}

/**
 * Build a simple markdown section from a template literal, trimming
 * surrounding whitespace.
 */
function md(strings: TemplateStringsArray, ...values: string[]): string {
  let result = "";
  for (let i = 0; i < strings.length; i++) {
    result += strings[i] || "";
    if (i < values.length) result += values[i] || "";
  }
  return result.trim();
}

/* ── Section builders ───────────────────────────────────────────────── */

function buildIntroSection(
  projectName: string,
  projectContext?: { description?: string | null }
): string {
  const desc = projectContext?.description?.trim();
  return md`
## Introducción

${projectName} es un proyecto validado a través del proceso de *BrewIdea Validator*.
Este Brand Book consolida la identidad de marca definida a lo largo de la fase
de identidad, incluyendo nombre, voz, tono, paleta de colores, tipografía y
directrices visuales.

${desc ? `**Contexto del proyecto:** ${desc}` : ""}

Utiliza este documento como referencia única para mantener la coherencia de
marca en todas las comunicaciones, productos y materiales del proyecto.
`;
}

function buildNamingSection(projectName: string, rationale: string): string {
  return md`
## Nombre y Rationale

**Nombre elegido:** ${projectName}

${rationale ? rationale : "PENDIENTE: completar sub-fase naming para generar este contenido."}
`;
}

function buildLogoSection(projectName: string): string {
  return md`
## Logo y Uso

> PENDIENTE: completar la sub-fase visual para generar este contenido.

El logotipo de **${projectName}** debe reflejar la identidad visual definida
en la paleta de colores y tipografía. A continuación se indican las directrices
generales:

### Variantes del logo

- **Principal:** Versión a todo color para fondos claros.
- **Monocromo:** Para aplicaciones sobre fondos de color sólido.
- **Símbolo:** Versión reducida para favicons, avatares y espacios pequeños.

### Área de seguridad

Mantén un margen mínimo equivalente a la altura de la "x" del logotipo alrededor
del mismo. No coloques otros elementos gráficos dentro de esta zona.

### Tamaño mínimo

- **Impresión:** 20 mm de ancho.
- **Digital:** 80 px de ancho.
- **Favicon / app icon:** Adaptar el símbolo a 16×16 px o 32×32 px.

### Usos incorrectos

- No estirar, rotar ni deformar el logo.
- No cambiar los colores fuera de la paleta definida.
- No aplicar sombras, biseles ni efectos.
- No usar sobre fondos con poco contraste.
`;
}

function buildColorSection(visualMeta: BrandBookVisualMeta | null): string {
  if (!visualMeta) {
    return md`
## Paleta de Colores

> PENDIENTE: completar la sub-fase visual para generar este contenido.
`;
  }

  const { primaryColor, secondaryColor } = visualMeta;
  return md`
## Paleta de Colores

La paleta de colores define la identidad cromática de la marca. Usa estos colores
de forma consistente en todos los soportes.

### Colores principales

| Rol | Color | Hex | Uso |
|-----|-------|-----|-----|
| **Primario** | ${primaryColor} | \`${primaryColor}\` | Fondos principales, botones, encabezados |
| **Secundario** | ${secondaryColor} | \`${secondaryColor}\` | Acentos, CTAs, enlaces, elementos decorativos |

### Escala de grises (por defecto)

| Tono | Hex | Uso |
|------|-----|-----|
| Negro | \`#111827\` | Texto principal |
| Gris oscuro | \`#374151\` | Texto secundario |
| Gris medio | \`#6B7280\` | Texto terciario, iconos |
| Gris claro | \`#D1D5DB\` | Bordes, separadores |
| Blanco | \`#FFFFFF\` | Fondos, texto sobre colores oscuros |

### Reglas de uso

- El color **primario** debe dominar al menos el 60% de la superficie de color en
  cualquier composición.
- El color **secundario** se usa como acento (~10-20% de la superficie).
- No uses degradados que mezclen el primario con colores fuera de la paleta.
`;
}

function buildTypographySection(
  visualMeta: BrandBookVisualMeta | null
): string {
  if (!visualMeta) {
    return md`
## Tipografía

> PENDIENTE: completar la sub-fase visual para generar este contenido.
`;
  }

  const { fontHeading, fontBody } = visualMeta;
  return md`
## Tipografía

La tipografía es uno de los pilares de la identidad visual. Usa estas familias
de forma consistente en web, apps y materiales impresos.

### Fuentes

| Rol | Familia | Tamaño | Peso |
|-----|---------|--------|------|
| **Heading** | ${fontHeading} | 24-48px | Bold / 700 |
| **Subheading** | ${fontHeading} | 18-24px | Semibold / 600 |
| **Body** | ${fontBody} | 14-16px | Regular / 400 |
| **Caption** | ${fontBody} | 11-13px | Regular / 400 |

### Jerarquía

1. **H1:** ${fontHeading}, 32-48px, Bold — títulos de página
2. **H2:** ${fontHeading}, 24-32px, Bold — secciones principales
3. **H3:** ${fontHeading}, 18-24px, Semibold — subsecciones
4. **Body:** ${fontBody}, 14-16px, Regular — texto corrido
5. **Caption:** ${fontBody}, 11-13px, Regular — pies de foto, notas

### Reglas

- No uses más de 3 tamaños distintos en una misma vista.
- El interlineado debe ser 1.5× el tamaño de fuente para body text.
- Usa tracking (letter-spacing) de -0.01em para headings grandes.
`;
}

function buildVoiceSection(voiceSummary: string): string {
  if (!voiceSummary) {
    return md`
## Voz y Tono

> PENDIENTE: completar la sub-fase voice para generar este contenido.
`;
  }
  return md`
## Voz y Tono

${voiceSummary}
`;
}

function buildImagerySection(
  visualMeta: BrandBookVisualMeta | null
): string {
  if (!visualMeta) {
    return md`
## Estilo Visual

> PENDIENTE: completar la sub-fase visual para generar este contenido.
`;
  }

  const { mood } = visualMeta;
  return md`
## Estilo Visual

**Mood:** ${mood || "No definido"}

### Directrices de imagen

- **Fotografía:** Usa imágenes con iluminación natural, tonos cálidos y encuadres
  que transmitan autenticidad. Evita imágenes de stock genéricas.
- **Ilustraciones:** Estilo vectorial limpio con trazos finos. Usa la paleta de
  colores primaria como base y añade acentos del secundario.
- **Iconografía:** Línea fina (1-2px), esquinas redondeadas. Prefiere iconos
  outline sobre sólidos. Usa el color primario para iconos interactivos.

### Fotografía de producto / servicio

- Fondo limpio o contextual.
- Iluminación difusa (sin sombras duras).
- Las personas deben aparecer en entornos naturales (no poses forzadas).

### No usar

- Imágenes con marcas de agua visibles.
- Fotografías con filtros extremos (HDR agresivo, saturación forzada).
- Clip art o iconos de baja resolución.
`;
}

function buildApplicationsSection(
  projectName: string,
  visualMeta: BrandBookVisualMeta | null
): string {
  const colorNote = visualMeta
    ? md`
- **Paleta:** ${visualMeta.primaryColor} (primario), ${visualMeta.secondaryColor} (secundario)
- **Tipografía:** ${visualMeta.fontHeading} / ${visualMeta.fontBody}
`
    : "";
  return md`
## Ejemplos de Aplicación

A continuación se muestran ejemplos de cómo aplicar la identidad de
**${projectName}** en distintos soportes.

### Tarjeta de presentación

- **Fondo:** ${visualMeta?.primaryColor || "Color primario"}
- **Nombre:** ${visualMeta?.fontHeading || "Fuente heading"}, Bold, blanco
- **Cargo:** ${visualMeta?.fontBody || "Fuente body"}, Regular, blanco con opacidad 80%
- **Contacto:** Ícono monocromo + texto en la esquina inferior

### Web / App

${colorNote}
- **Header:** Fondo primario, texto blanco
- **Botones CTA:** Fondo secundario, texto blanco, bordes redondeados (8px)
- **Cards:** Fondo blanco, sombra sutil, bordes redondeados (12px)

### Redes sociales

- **Posts:** Usa la paleta de colores para los fondos de las gráficas.
  Superponer texto blanco con la fuente heading.
- **Stories:** Fondo primario con degradado sutil. Texto centrado.
- **Avatar:** Símbolo del logo sobre fondo primario.

### Email

- **Header:** Fondo primario, logo en blanco.
- **Body:** Fondo blanco, texto en gris oscuro.
- **Botones:** Fondo secundario, texto blanco, bordes redondeados.
`;
}

function buildDosDontsSection(): string {
  return md`
## Do's & Don'ts

### ✅ Do's

- Usa la paleta de colores definida de manera consistente.
- Mantén el área de seguridad alrededor del logo.
- Usa las fuentes corporativas en todos los materiales.
- Aplica la voz y tono definidos en todas las comunicaciones.
- Pide revisión de marca antes de publicar materiales externos.

### ❌ Don'ts

- No uses colores fuera de la paleta sin aprobación.
- No estires, rote ni deformes el logo.
- No uses tipografías alternativas sin justificación.
- No mezcles tonos de voz inconsistentes en la misma campaña.
- No crees variantes del logo sin consultar.
`;
}

/* ── Public API ─────────────────────────────────────────────────────── */

export interface BuildBrandBookParams {
  /** Project display name (from the naming sub-step or project creation). */
  projectName: string;
  /** Raw markdown/text content from the naming sub-step artifact. */
  namingContent: string | null;
  /** Raw markdown/text content from the voice sub-step artifact. */
  voiceContent: string | null;
  /** The variant the user chose in the visual sub-step: "A", "B" or "C". */
  visualChoice: string | null;
  /** Raw JSON string from the visual sub-step artifact (`subStepArtifact.content`). */
  visualArtifactJson: string | null;
  /** Optional project context for the intro section. */
  projectContext?: { description?: string | null };
}

/**
 * Builds a consolidated Brand Book from the outputs of the naming,
 * voice and visual sub-steps.
 *
 * The function is **defensive**: if any sub-step artifact is missing
 * (e.g. the user hasn't completed that sub-step yet), the corresponding
 * sections are filled with a "PENDIENTE: completar sub-fase X" placeholder.
 */
export function buildBrandBook(params: BuildBrandBookParams): BrandBook {
  const {
    projectName,
    namingContent,
    voiceContent,
    visualChoice,
    visualArtifactJson,
    projectContext,
  } = params;

  const visualArtifact = parseVisualArtifactContent(visualArtifactJson);
  const chosenVariant = (visualChoice || "A").toUpperCase();
  const validVariant = (
    chosenVariant === "A" || chosenVariant === "B" || chosenVariant === "C"
      ? chosenVariant
      : "A"
  ) as "A" | "B" | "C";

  let visualMeta: BrandBookVisualMeta | null = null;
  if (visualArtifact) {
    const opt = visualArtifact.options.find(
      (o) => o.variant === validVariant
    );
    if (opt) {
      visualMeta = {
        variant: validVariant,
        name: opt.meta.name,
        primaryColor: opt.meta.primaryColor,
        secondaryColor: opt.meta.secondaryColor,
        fontHeading: opt.meta.fontHeading,
        fontBody: opt.meta.fontBody,
        mood: opt.meta.mood,
      };
    }
  }

  const namingRationale = extractNamingRationale(namingContent);
  const voiceSummary = extractVoiceSummary(voiceContent);

  const sections: BrandBookSection[] = [
    {
      id: "intro",
      title: "Introducción",
      order: 0,
      content: buildIntroSection(projectName, projectContext),
    },
    {
      id: "naming",
      title: "Nombre y rationale",
      order: 1,
      content: buildNamingSection(projectName, namingRationale),
    },
    {
      id: "logo",
      title: "Logo y uso",
      order: 2,
      content: buildLogoSection(projectName),
    },
    {
      id: "color",
      title: "Paleta de colores",
      order: 3,
      content: buildColorSection(visualMeta),
    },
    {
      id: "typography",
      title: "Tipografía",
      order: 4,
      content: buildTypographySection(visualMeta),
    },
    {
      id: "voice",
      title: "Voz y tono",
      order: 5,
      content: buildVoiceSection(voiceSummary),
    },
    {
      id: "imagery",
      title: "Estilo visual",
      order: 6,
      content: buildImagerySection(visualMeta),
    },
    {
      id: "applications",
      title: "Ejemplos de aplicación",
      order: 7,
      content: buildApplicationsSection(projectName, visualMeta),
    },
    {
      id: "dosdonts",
      title: "Do's & Don'ts",
      order: 8,
      content: buildDosDontsSection(),
    },
  ];

  return {
    projectName,
    generatedAt: new Date().toISOString(),
    sections,
    meta: {
      namingRationale: namingRationale || undefined,
      voiceSummary,
      visualMeta,
    },
  };
}

/**
 * Serializes a BrandBook to a single markdown string suitable for
 * rendering in the UI or passing to the PDF pipeline.
 */
export function brandBookToMarkdown(brandBook: BrandBook): string {
  return brandBook.sections
    .sort((a, b) => a.order - b.order)
    .map((s) => s.content)
    .join("\n\n---\n\n");
}

/* ── Identity choices extraction ────────────────────────────────────── */

/** Minimal shape of an IDENTITY ProjectPhase needed to rebuild the Brand Book. */
export interface IdentityPhaseLike {
  subStepHistory?: unknown;
  subStepArtifact?: unknown;
  subStepChoice?: string | null;
  artifacts?: unknown;
}

/** A single confirmed sub-step entry as stored in `subStepHistory`. */
interface SubStepHistoryEntry {
  subStep?: string;
  label?: string;
  choice?: string;
  artifact?: { type?: string; content?: string; options?: unknown } | null;
}

/** Reads the history map (object keyed by subStep id) defensively. */
function readHistory(phase: IdentityPhaseLike): Record<string, SubStepHistoryEntry> {
  const h = phase.subStepHistory;
  if (h && typeof h === "object" && !Array.isArray(h)) {
    return h as Record<string, SubStepHistoryEntry>;
  }
  return {};
}

/** Pulls the markdown content out of a sub-step artifact, if present. */
function artifactContent(artifact: SubStepHistoryEntry["artifact"]): string | null {
  if (artifact && typeof artifact === "object" && typeof artifact.content === "string") {
    return artifact.content;
  }
  return null;
}

/**
 * Returns the JSON string `parseVisualArtifactContent` expects (an object with
 * a top-level `options` array). The visual sub-step stores
 * `{ type: "html", content: "<JSON string with options>" }`, so we unwrap the
 * inner `content`. If the artifact already carries `options`, we re-serialize.
 */
function visualJsonFromArtifact(artifact: SubStepHistoryEntry["artifact"]): string | null {
  if (!artifact || typeof artifact !== "object") return null;
  if (typeof artifact.content === "string") {
    const t = artifact.content.trim();
    if (t.startsWith("{") || t.startsWith("[")) return artifact.content;
  }
  if (Array.isArray(artifact.options)) {
    return JSON.stringify({ options: artifact.options });
  }
  return null;
}

/** The four inputs `buildBrandBook` needs, derived from a phase. */
export interface IdentityChoices {
  namingContent: string | null;
  voiceContent: string | null;
  visualChoice: string | null;
  visualArtifactJson: string | null;
}

/**
 * Extracts the chosen options of each IDENTITY sub-step (naming / voice /
 * visual) from a phase. Prefers `subStepHistory` (where every sub-step is
 * preserved independently); falls back to the legacy singular
 * `subStepArtifact`/`subStepChoice` fields for projects completed before the
 * history field existed.
 *
 * This is the single source of truth for assembling the Brand Book — every
 * consumer (hand-off, export, brandbook view/download) must use it so the
 * naming choice is never confused with the visual choice.
 */
export function extractIdentityChoices(phase: IdentityPhaseLike): IdentityChoices {
  const history = readHistory(phase);
  const naming = history["naming"];
  const voice = history["voice"];
  const visual = history["visual"];

  // ── Naming: chosen name + rationale from the naming artifact ──
  let namingContent: string | null = null;
  if (naming) {
    const rationale = artifactContent(naming.artifact);
    const chosen = naming.choice ? `**Nombre elegido:** ${naming.choice}` : null;
    namingContent = [chosen, rationale].filter(Boolean).join("\n\n") || null;
  }

  // ── Voice: markdown from the voice artifact (+ choice if it was a pick) ──
  let voiceContent: string | null = voice ? artifactContent(voice.artifact) : null;
  if (voice?.choice && voiceContent) {
    voiceContent = `**Opción elegida:** ${voice.choice}\n\n${voiceContent}`;
  } else if (voice?.choice && !voiceContent) {
    voiceContent = `**Opción elegida:** ${voice.choice}`;
  }

  // ── Visual: chosen variant + the inner options JSON ──
  let visualChoice: string | null = visual?.choice ?? null;
  let visualArtifactJson: string | null = visual
    ? visualJsonFromArtifact(visual.artifact)
    : null;

  // ── Fallback to the singular fields for visual whenever the history hasn't
  //    captured it yet. This covers two cases: (1) legacy projects completed
  //    before `subStepHistory` existed, and (2) a live preview while the user
  //    is still reviewing the `visual` sub-step (not yet confirmed, so not in
  //    history). The singular subStepArtifact/subStepChoice always hold the
  //    most recent visual, so they are the right source here. naming/voice of
  //    legacy projects are unrecoverable and stay null. ──
  if (!visualArtifactJson) {
    const legacyArtifact = phase.subStepArtifact as SubStepHistoryEntry["artifact"];
    visualArtifactJson = visualJsonFromArtifact(legacyArtifact);
  }
  if (!visualChoice) {
    visualChoice = phase.subStepChoice ?? null;
  }

  return { namingContent, voiceContent, visualChoice, visualArtifactJson };
}

/**
 * Convenience wrapper: builds a Brand Book directly from an IDENTITY phase,
 * pulling each sub-step's chosen option from `subStepHistory`.
 */
export function buildBrandBookFromPhase(
  phase: IdentityPhaseLike,
  projectName: string,
  projectContext?: { description?: string | null }
): BrandBook {
  const choices = extractIdentityChoices(phase);
  return buildBrandBook({
    projectName,
    namingContent: choices.namingContent,
    voiceContent: choices.voiceContent,
    visualChoice: choices.visualChoice,
    visualArtifactJson: choices.visualArtifactJson,
    projectContext,
  });
}
