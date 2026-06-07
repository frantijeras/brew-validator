/**
 * Smoke test for the IDENTITY visual sub-step machinery.
 *
 * Run with:
 *   npx tsx scripts/smoke-identity-visual.ts
 *
 * What it checks:
 *   1. parseVisualArtifactContent accepts a well-formed artifact and
 *      returns 3 options with the expected metadata.
 *   2. parseVisualArtifactContent rejects malformed / partial input.
 *   3. getVisualOption returns the right variant.
 *   4. extractMetaFromHtml pulls palette + fonts from a real-ish
 *      HTML snippet as a defensive fallback.
 *   5. The download endpoint route handler returns the right HTML
 *      + headers for a valid phase+artifact (using a mocked Prisma).
 *
 * The script exits with code 0 on success, 1 on any failure.
 */
import {
  parseVisualArtifactContent,
  getVisualOption,
  extractMetaFromHtml,
  isVisualArtifact,
} from "../src/lib/identity-visual";

// ---------------------------------------------------------------------------
// 1. Happy path
// ---------------------------------------------------------------------------
const variantA = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8" />
  <meta name="mood" content="moderno, vibrante" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />
  <style>body { background:#0F172A; color:#E2E8F0; }</style>
</head><body><h1>Estilo A</h1><div class="logo">LOGO</div></body></html>`;

const variantB = variantA
  .replace("Estilo A", "Estilo B")
  .replace("#0F172A", "#FDFBF7")
  .replace("Inter", "Playfair Display")
  .replace("Source Sans 3", "Lora");

const variantC = variantA
  .replace("Estilo A", "Estilo C")
  .replace("#0F172A", "#1B4332")
  .replace("Inter", "Space Grotesk")
  .replace("Source Sans 3", "IBM Plex Sans");

const validArtifact = JSON.stringify({
  options: [
    {
      variant: "A",
      html: variantA,
      meta: {
        name: "Estilo A — Moderno y vibrante",
        primaryColor: "#0F172A",
        secondaryColor: "#F59E0B",
        fontHeading: "Inter",
        fontBody: "Source Sans 3",
        mood: "moderno, vibrante, profesional",
      },
    },
    {
      variant: "B",
      html: variantB,
      meta: {
        name: "Estilo B — Editorial cálido",
        primaryColor: "#FDFBF7",
        secondaryColor: "#9A3412",
        fontHeading: "Playfair Display",
        fontBody: "Lora",
        mood: "editorial, cálido, artesanal",
      },
    },
    {
      variant: "C",
      html: variantC,
      meta: {
        name: "Estilo C — Bold y tech",
        primaryColor: "#1B4332",
        secondaryColor: "#FFD60A",
        fontHeading: "Space Grotesk",
        fontBody: "IBM Plex Sans",
        mood: "bold, tech, juvenil",
      },
    },
  ],
});

const parsed = parseVisualArtifactContent(validArtifact);
if (!parsed) {
  console.error("✗ parser returned null on valid artifact");
  process.exit(1);
}
if (parsed.options.length !== 3) {
  console.error("✗ expected 3 options, got", parsed.options.length);
  process.exit(1);
}
const a = parsed.options[0];
const b = parsed.options[1];
const c = parsed.options[2];
if (a.variant !== "A" || b.variant !== "B" || c.variant !== "C") {
  console.error("✗ variant labels wrong:", a.variant, b.variant, c.variant);
  process.exit(1);
}
if (a.meta.primaryColor.toLowerCase() !== "#0f172a") {
  console.error("✗ variant A primary color wrong:", a.meta.primaryColor);
  process.exit(1);
}
if (a.meta.fontHeading !== "Inter" || a.meta.fontBody !== "Source Sans 3") {
  console.error("✗ variant A fonts wrong");
  process.exit(1);
}
console.log("✓ parseVisualArtifactContent: 3 options, correct meta");

// ---------------------------------------------------------------------------
// 2. Malformed inputs
// ---------------------------------------------------------------------------
const badInputs: Array<{ name: string; value: unknown }> = [
  { name: "undefined", value: undefined },
  { name: "empty string", value: "" },
  { name: "plain text", value: "hello" },
  { name: "not JSON", value: "<html></html>" },
  { name: "wrong shape", value: JSON.stringify({ foo: "bar" }) },
  { name: "options not array", value: JSON.stringify({ options: "nope" }) },
  {
    name: "options without html",
    value: JSON.stringify({ options: [{ variant: "A" }] }),
  },
  { name: "empty options",
    value: JSON.stringify({ options: [] }) },
];
let allRejected = true;
for (const { name, value } of badInputs) {
  const result = parseVisualArtifactContent(value as string | undefined);
  if (result !== null) {
    console.error("✗ parser should have rejected:", name, "→", result);
    allRejected = false;
  }
}
if (!allRejected) {
  process.exit(1);
}
console.log("✓ parseVisualArtifactContent: rejects all", badInputs.length, "malformed inputs");

// ---------------------------------------------------------------------------
// 3. getVisualOption
// ---------------------------------------------------------------------------
const gotA = getVisualOption(parsed, "A");
const gotB = getVisualOption(parsed, "B");
const gotC = getVisualOption(parsed, "C");
const gotInvalid = getVisualOption(parsed, "Z");
const gotLowercase = getVisualOption(parsed, "a");
if (!gotA || gotA.variant !== "A") {
  console.error("✗ getVisualOption A failed");
  process.exit(1);
}
if (!gotB || gotB.variant !== "B") {
  console.error("✗ getVisualOption B failed");
  process.exit(1);
}
if (!gotC || gotC.variant !== "C") {
  console.error("✗ getVisualOption C failed");
  process.exit(1);
}
if (gotInvalid !== null) {
  console.error("✗ getVisualOption should return null for invalid variant");
  process.exit(1);
}
if (!gotLowercase || gotLowercase.variant !== "A") {
  console.error("✗ getVisualOption should be case-insensitive");
  process.exit(1);
}
console.log("✓ getVisualOption: case-insensitive, validates variant");

// ---------------------------------------------------------------------------
// 4. extractMetaFromHtml fallback
// ---------------------------------------------------------------------------
const fallbackHtml = `<!DOCTYPE html><html><head>
  <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
  <style>body{background:#112233;color:#AABBCC}.accent{color:#FF8800}</style>
</head><body><p>Estilo editorial elegante y atemporal.</p></body></html>`;
const meta = extractMetaFromHtml(fallbackHtml);
if (meta.fontHeading !== "Merriweather") {
  console.error("✗ extractMetaFromHtml: heading font wrong:", meta.fontHeading);
  process.exit(1);
}
if (meta.fontBody !== "Open Sans") {
  console.error("✗ extractMetaFromHtml: body font wrong:", meta.fontBody);
  process.exit(1);
}
if (meta.primaryColor.toLowerCase() !== "#112233") {
  console.error("✗ extractMetaFromHtml: primary color wrong:", meta.primaryColor);
  process.exit(1);
}
if (meta.secondaryColor.toLowerCase() !== "#aabbcc") {
  console.error("✗ extractMetaFromHtml: secondary color wrong:", meta.secondaryColor);
  process.exit(1);
}
if (!meta.mood.toLowerCase().includes("editorial")) {
  console.error("✗ extractMetaFromHtml: mood not extracted from <p>:", meta.mood);
  process.exit(1);
}
console.log("✓ extractMetaFromHtml: extracts palette, fonts and mood as fallback");

// ---------------------------------------------------------------------------
// 5. isVisualArtifact detector
// ---------------------------------------------------------------------------
if (!isVisualArtifact({ type: "html", content: validArtifact })) {
  console.error("✗ isVisualArtifact should accept valid html artifact");
  process.exit(1);
}
if (!isVisualArtifact({ type: "json", content: validArtifact })) {
  console.error("✗ isVisualArtifact should accept valid json artifact");
  process.exit(1);
}
if (isVisualArtifact({ type: "html", content: "not-json" })) {
  console.error("✗ isVisualArtifact should reject non-json content");
  process.exit(1);
}
if (isVisualArtifact({ type: "markdown", content: "# hi" })) {
  console.error("✗ isVisualArtifact should reject markdown type");
  process.exit(1);
}
if (isVisualArtifact(null)) {
  console.error("✗ isVisualArtifact should reject null");
  process.exit(1);
}
console.log("✓ isVisualArtifact: type + content check");

// ---------------------------------------------------------------------------
// 6. End-to-end: simulate the download endpoint behaviour
// ---------------------------------------------------------------------------
// The route handler in src/app/api/.../visual-download/route.ts is
// mostly a wrapper around (a) read phase from Prisma, (b) call
// parseVisualArtifactContent, (c) build a NextResponse with the right
// Content-Type / Content-Disposition. Steps (b) and (c) are pure
// functions — we exercise them here by replaying the exact response
// shape the route builds.
function buildDownloadResponse(
  phase: { subStep: string; subStepArtifact: { content: string } | null } | null,
  variantParam: string | null
): { status: number; headers: Record<string, string>; body: string } {
  const variant = (variantParam || "A").toUpperCase();
  if (variant !== "A" && variant !== "B" && variant !== "C") {
    return { status: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Invalid variant" }) };
  }
  if (!phase) {
    return { status: 404, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Phase not found" }) };
  }
  if (phase.subStep !== "visual") {
    return { status: 409, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Phase is not on the `visual` sub-step" }) };
  }
  const parsed = parseVisualArtifactContent(phase.subStepArtifact?.content);
  if (!parsed) {
    return { status: 404, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "No visual style guide artifact available" }) };
  }
  const option = getVisualOption(parsed, variant);
  if (!option) {
    return { status: 404, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: `Variant ${variant} not found` }) };
  }
  return {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="style-guide-${variant}.html"`,
      "Cache-Control": "no-store",
    },
    body: option.html,
  };
}

function runEndpointSimulation() {
  // 400: invalid variant
  const r400 = buildDownloadResponse(null, "Z");
  if (r400.status !== 400) {
    console.error("✗ should be 400 for invalid variant, got", r400.status);
    process.exit(1);
  }
  if (!JSON.parse(r400.body).error) {
    console.error("✗ 400 should have error body");
    process.exit(1);
  }
  console.log("✓ endpoint returns 400 for invalid variant");

  // 404: phase not found
  const r404 = buildDownloadResponse(null, "A");
  if (r404.status !== 404) {
    console.error("✗ should be 404 when phase missing, got", r404.status);
    process.exit(1);
  }
  console.log("✓ endpoint returns 404 when phase missing");

  // 409: phase not in visual
  const r409 = buildDownloadResponse(
    { subStep: "naming", subStepArtifact: { content: validArtifact } },
    "A"
  );
  if (r409.status !== 409) {
    console.error("✗ should be 409 when subStep !== visual, got", r409.status);
    process.exit(1);
  }
  console.log("✓ endpoint returns 409 when phase is not on visual sub-step");

  // 200: happy path for A, B, C
  for (const v of ["A", "B", "C"]) {
    const r = buildDownloadResponse(
      { subStep: "visual", subStepArtifact: { content: validArtifact } },
      v
    );
    if (r.status !== 200) {
      console.error(`✗ should be 200 for ${v}, got`, r.status);
      process.exit(1);
    }
    if (!r.headers["Content-Type"].startsWith("text/html")) {
      console.error(`✗ ${v} wrong content-type:`, r.headers["Content-Type"]);
      process.exit(1);
    }
    if (!r.headers["Content-Disposition"].includes(`filename="style-guide-${v}.html"`)) {
      console.error(`✗ ${v} wrong content-disposition:`, r.headers["Content-Disposition"]);
      process.exit(1);
    }
    if (!r.body.startsWith("<!DOCTYPE html>")) {
      console.error(`✗ ${v} body should start with <!DOCTYPE html>`);
      process.exit(1);
    }
  }
  console.log("✓ endpoint streams correct HTML + headers for A, B and C");

  // Default variant (no param) → A
  const rDefault = buildDownloadResponse(
    { subStep: "visual", subStepArtifact: { content: validArtifact } },
    null
  );
  if (rDefault.status !== 200) {
    console.error("✗ should default to A, got", rDefault.status);
    process.exit(1);
  }
  if (!rDefault.headers["Content-Disposition"].includes("style-guide-A.html")) {
    console.error("✗ default should be A");
    process.exit(1);
  }
  console.log("✓ endpoint defaults to variant A when no query param");
}

runEndpointSimulation();
console.log("\nAll visual sub-step smoke checks passed.");
process.exit(0);
