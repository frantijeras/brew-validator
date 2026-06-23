/**
 * IDENTITY phase — visual sub-step machinery.
 *
 * The `visual` sub-step of the IDENTITY phase produces 3 HTML style
 * guides (A / B / C). The agent `project-template` emits them in the
 * `subStepArtifact.content` field as a single JSON string with shape:
 *
 *   { "options": [VisualStyleGuide, VisualStyleGuide, VisualStyleGuide] }
 *
 * The frontend (phase-substep-modal) parses this content with
 * `parseVisualArtifactContent` to render an iframe, a meta card and
 * the navigation tabs. The visual-download endpoint uses the same
 * parser to serve the raw HTML.
 *
 * IMPORTANT: keep this file in sync with the `project-template` agent
 * contract documented in `docs/identity-visual-spec.md`. Any change to
 * the JSON shape must be reflected on both sides.
 */

/** A single style-guide option (A, B or C). */
export interface VisualStyleGuide {
  /** Variant label — exactly "A", "B" or "C". */
  variant: "A" | "B" | "C";
  /**
   * The COMPLETE HTML document for the style guide. It MUST be a
   * self-contained HTML5 document with NO external resources: no remote
   * scripts, no remote images, and no remote fonts (no Google Fonts links
   * ni @import). Typography uses system font stacks or @font-face with
   * data: URIs. The explicit `meta` below is the source of truth for
   * palette + typography (the skill emits it per option); the HTML parse
   * (`extractMetaFromHtml`) is only a fallback when `meta` is incomplete.
   */
  html: string;
  /**
   * Structured metadata extracted from the HTML (or explicitly set by
   * the agent). Used by the meta card in the UI to show palette,
   * typography and mood at a glance.
   */
  meta: {
    /** Human-friendly name, e.g. "Estilo A — Moderno y vibrante". */
    name: string;
    /** Primary brand color in hex (e.g. "#0F172A"). */
    primaryColor: string;
    /** Secondary brand color in hex (e.g. "#F59E0B"). */
    secondaryColor: string;
    /** Heading font family name, e.g. "Inter". */
    fontHeading: string;
    /** Body font family name, e.g. "Source Sans 3". */
    fontBody: string;
    /** Short mood description, e.g. "moderno, vibrante, profesional". */
    mood: string;
  };
}

/** Shape of the JSON stored inside `subStepArtifact.content`. */
export interface VisualArtifactContent {
  options: [VisualStyleGuide, VisualStyleGuide, VisualStyleGuide];
}

/** Hex color pattern (with or without alpha). */
const HEX_COLOR = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

/** Best-effort metadata extracted from an HTML style guide. */
export interface ExtractedVisualMeta {
  primaryColor: string;
  secondaryColor: string;
  fontHeading: string;
  fontBody: string;
  mood: string;
}

const FALLBACK_META: ExtractedVisualMeta = {
  primaryColor: "#0F172A",
  secondaryColor: "#F59E0B",
  fontHeading: "Inter",
  fontBody: "Inter",
  mood: "",
};

/**
 * Extracts palette / typography / mood from a raw HTML string.
 *
 * The agent is expected to provide explicit `meta` values, but we keep
 * this helper around to be defensive: if the meta block is missing or
 * partially broken, we still surface something usable in the UI.
 */
export function extractMetaFromHtml(html: string): ExtractedVisualMeta {
  if (!html || typeof html !== "string") {
    return { ...FALLBACK_META };
  }
  const colors = Array.from(html.matchAll(new RegExp(HEX_COLOR, "g"))).map(
    (m) => m[0]
  );
  const primaryColor = colors[0] || FALLBACK_META.primaryColor;
  const secondaryColor =
    colors.find((c) => c.toLowerCase() !== primaryColor.toLowerCase()) ||
    FALLBACK_META.secondaryColor;

  // Google Fonts: look at the href query string for family=... and
  // strip the optional `:wght@400;700` weight specifier that the
  // css2 endpoint appends. The first family in the URL is usually
  // the heading, the rest are bodies.
  const familyMatches = Array.from(
    html.matchAll(/family=([^&"']+)/g)
  ).map((m) =>
    decodeURIComponent(m[1].replace(/\+/g, " ")).split(":")[0].trim()
  );
  const fontHeading = familyMatches[0] || FALLBACK_META.fontHeading;
  const fontBody = familyMatches[1] || fontHeading;

  // Mood: look for a <meta name="mood"> tag, fall back to first <p> in body.
  const moodMatch =
    html.match(/<meta\s+name=["']mood["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']mood["']/i);
  let mood = moodMatch ? moodMatch[1].trim() : "";
  if (!mood) {
    const pMatch = html.match(/<p[^>]*>([^<]{4,120})<\/p>/i);
    if (pMatch) mood = pMatch[1].trim();
  }

  return {
    primaryColor,
    secondaryColor,
    fontHeading,
    fontBody,
    mood,
  };
}

/**
 * Validates a single option. Returns the option normalized, or null
 * if the option is unusable (missing HTML, wrong variant, etc.).
 */
function normalizeOption(
  raw: unknown,
  fallbackVariant: "A" | "B" | "C"
): VisualStyleGuide | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const html =
    typeof obj.html === "string" && obj.html.trim().length > 0
      ? obj.html
      : null;
  if (!html) return null;

  const declaredVariant = obj.variant;
  const variant: "A" | "B" | "C" =
    declaredVariant === "A" || declaredVariant === "B" || declaredVariant === "C"
      ? declaredVariant
      : fallbackVariant;

  const metaRaw = (obj.meta && typeof obj.meta === "object"
    ? (obj.meta as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const extracted = extractMetaFromHtml(html);

  const meta: VisualStyleGuide["meta"] = {
    name:
      typeof metaRaw.name === "string" && metaRaw.name.trim().length > 0
        ? metaRaw.name.trim()
        : `Estilo ${variant}`,
    primaryColor:
      typeof metaRaw.primaryColor === "string" &&
      HEX_COLOR.test(metaRaw.primaryColor)
        ? metaRaw.primaryColor
        : extracted.primaryColor,
    secondaryColor:
      typeof metaRaw.secondaryColor === "string" &&
      HEX_COLOR.test(metaRaw.secondaryColor)
        ? metaRaw.secondaryColor
        : extracted.secondaryColor,
    fontHeading:
      typeof metaRaw.fontHeading === "string" && metaRaw.fontHeading.trim()
        ? metaRaw.fontHeading.trim()
        : extracted.fontHeading,
    fontBody:
      typeof metaRaw.fontBody === "string" && metaRaw.fontBody.trim()
        ? metaRaw.fontBody.trim()
        : extracted.fontBody,
    mood:
      typeof metaRaw.mood === "string"
        ? metaRaw.mood.trim()
        : extracted.mood,
  };

  return { variant, html, meta };
}

const VARIANT_ORDER: ReadonlyArray<"A" | "B" | "C"> = ["A", "B", "C"];

/**
 * Parses the raw `subStepArtifact.content` value and returns the
 * VisualArtifactContent (3 options) or null when the artifact is
 * missing / malformed.
 *
 * The agent contract allows the JSON to live directly in `content`
 * OR in `content` as a JSON string. We try the object form first and
 * fall back to JSON.parse.
 */
export function parseVisualArtifactContent(
  raw: string | undefined | null
): VisualArtifactContent | null {
  if (!raw || typeof raw !== "string") return null;

  let candidate: unknown;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return null;
    }
  } else {
    return null;
  }

  if (!candidate || typeof candidate !== "object") return null;
  const optionsRaw = (candidate as { options?: unknown }).options;
  if (!Array.isArray(optionsRaw) || optionsRaw.length === 0) return null;

  const normalized: VisualStyleGuide[] = [];
  for (let i = 0; i < VARIANT_ORDER.length; i++) {
    const fallbackVariant = VARIANT_ORDER[i];
    const opt = normalizeOption(optionsRaw[i], fallbackVariant);
    if (opt) normalized.push(opt);
  }

  if (normalized.length === 0) return null;

  // Pad missing variants with a tiny placeholder so the UI always
  // shows 3 tabs. The placeholder is a valid HTML5 document with the
  // variant name so the iframe still renders something.
  while (normalized.length < 3) {
    const missing = VARIANT_ORDER[normalized.length];
    normalized.push(makePlaceholderOption(missing));
  }

  return {
    options: [normalized[0], normalized[1], normalized[2]],
  };
}

/**
 * Returns the option for a given variant (A / B / C), or null if the
 * artifact has no options. Variant matching is case-insensitive.
 */
export function getVisualOption(
  content: VisualArtifactContent | null,
  variant: string | null | undefined
): VisualStyleGuide | null {
  if (!content) return null;
  const v = (variant || "A").toUpperCase();
  if (v !== "A" && v !== "B" && v !== "C") return null;
  return content.options.find((o) => o.variant === v) || null;
}

/**
 * Builds a placeholder option for variants the agent didn't emit
 * (defensive — we expect the agent to always emit 3, but we don't
 * want the UI to crash if it doesn't).
 */
function makePlaceholderOption(variant: "A" | "B" | "C"): VisualStyleGuide {
  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Estilo ${variant} — no disponible</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 40px; background: #0F172A; color: #E2E8F0; }
      .box { max-width: 480px; margin: 80px auto; padding: 32px; border: 1px dashed #475569; border-radius: 12px; text-align: center; }
      h1 { color: #F59E0B; margin: 0 0 8px; font-size: 18px; }
      p { color: #94A3B8; font-size: 14px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>Estilo ${variant} no disponible</h1>
      <p>El agente no generó esta variante. Vuelve a iterar o pide una nueva propuesta.</p>
    </div>
  </body>
</html>`;
  return {
    variant,
    html,
    meta: {
      name: `Estilo ${variant} (no disponible)`,
      primaryColor: "#0F172A",
      secondaryColor: "#F59E0B",
      fontHeading: "Inter",
      fontBody: "Inter",
      mood: "",
    },
  };
}

/**
 * Detects whether an artifact is a "visual" style guide (i.e. its
 * `content` is a JSON with 3 options). Used by the modal to decide
 * which rendering path to use.
 */
export function isVisualArtifact(artifact: {
  type?: string;
  content?: string;
} | null | undefined): boolean {
  if (!artifact) return false;
  if (artifact.type !== "html" && artifact.type !== "json") return false;
  return parseVisualArtifactContent(artifact.content) !== null;
}
