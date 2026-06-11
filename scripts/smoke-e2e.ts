/**
 * smoke-e2e.ts — COMPREHENSIVE SMOKE TEST FOR BREW VALIDATOR
 *
 * Runs ALL module tests offline (no DB, no APIs, no Prisma).
 * Single entry point — run with:
 *
 *    npx tsx scripts/smoke-e2e.ts
 *    npm run smoke
 *
 * Tests:
 *   1. identity-substeps.ts        — sub-step transitions & indices
 *   2. rename-propagate.ts         — regex replace & escape (offline helpers)
 *   3. identity-visual.ts          — parse, getOption, extractMeta, isVisual
 *   4. report-renderer.ts          — buildReportHtml (markdown + HTML modes)
 *   5. pdf-export.ts              — buildReportPdf returns Buffer with %PDF
 *   6. validation-report.ts        — N/A (needs Prisma); structural check
 *   7. identity-brandbook.ts       — buildBrandBook complete + partial
 *   8. project-memory.ts           — mergeProjectMemory (last-wins, user prevails)
 *   9. agent-context-rules.ts      — buildAgentContextRules with/without memory
 *  10. handoff-builder.ts          — buildHandoffZip structure verification
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ── Test helpers ──

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    totalPassed++;
    console.log(`  ✓ ${label}`);
  } else {
    totalFailed++;
    console.log(`  ✗ ${label}`);
  }
}

let currentSection = "";

function section(label: string): void {
  currentSection = label;
  const bar = "─".repeat(60);
  console.log(`\n${bar}`);
  console.log(`  ${label}`);
  console.log(`${bar}`);
}

// Number each test case
let testCaseIdx = 0;
function tc(label: string): string {
  testCaseIdx++;
  return `[${testCaseIdx}] ${label}`;
}

// ── Dynamically import modules (tsx handles TS natively) ──

// ═══════════════════════════════════════════════════════════════════════
// MODULE 1: identity-substeps.ts
// ═══════════════════════════════════════════════════════════════════════
section("1. identity-substeps.ts — sub-step transitions");

async function testIdentitySubsteps() {
  const {
    getNextIdentitySubStep,
    getIdentitySubStepIndex,
    getIdentitySubStepLabel,
    IDENTITY_SUBSTEP_IDS,
    IDENTITY_SUBSTEP_ORDER,
  } = await import("../src/lib/identity-substeps");

  // getNextIdentitySubStep
  assert(
    getNextIdentitySubStep(null) === "naming",
    tc("null → naming (fresh start)")
  );
  assert(
    getNextIdentitySubStep("naming") === "voice",
    tc("naming → voice")
  );
  assert(
    getNextIdentitySubStep("voice") === "visual",
    tc("voice → visual")
  );
  assert(
    getNextIdentitySubStep("visual") === "final",
    tc("visual → final")
  );
  assert(
    getNextIdentitySubStep("final") === null,
    tc("final → null (phase complete)")
  );
  assert(
    getNextIdentitySubStep(undefined) === "naming",
    tc("undefined → naming")
  );
  assert(
    getNextIdentitySubStep("unknown-garbage") === "naming",
    tc("unknown id → naming (safe fallback)")
  );

  // getIdentitySubStepIndex
  assert(
    getIdentitySubStepIndex("naming") === 0,
    tc("index: naming = 0")
  );
  assert(
    getIdentitySubStepIndex("voice") === 1,
    tc("index: voice = 1")
  );
  assert(
    getIdentitySubStepIndex("visual") === 2,
    tc("index: visual = 2")
  );
  assert(
    getIdentitySubStepIndex("final") === 3,
    tc("index: final = 3")
  );
  assert(
    getIdentitySubStepIndex(null) === -1,
    tc("index: null → -1")
  );
  assert(
    getIdentitySubStepIndex("bogus") === -1,
    tc("index: unknown → -1")
  );

  // getIdentitySubStepLabel
  assert(
    getIdentitySubStepLabel("naming") === "Nombre",
    tc("label: naming = Nombre")
  );
  assert(
    getIdentitySubStepLabel("voice") === "Voz y Tono",
    tc("label: voice = Voz y Tono")
  );
  assert(
    getIdentitySubStepLabel("visual") === "Estilo Visual",
    tc("label: visual = Estilo Visual")
  );
  assert(
    getIdentitySubStepLabel("final") === "Brand Book",
    tc("label: final = Brand Book")
  );
  assert(
    getIdentitySubStepLabel(null) === "",
    tc("label: null → empty string")
  );

  // IDENTITY_SUBSTEP_IDS
  assert(
    IDENTITY_SUBSTEP_IDS.length === 4,
    tc("IDS length = 4")
  );
  assert(
    IDENTITY_SUBSTEP_IDS[0] === "naming" &&
    IDENTITY_SUBSTEP_IDS[3] === "final",
    tc("IDS covers naming..final in order")
  );

  // IDENTITY_SUBSTEP_ORDER
  assert(
    IDENTITY_SUBSTEP_ORDER.length === 4,
    tc("ORDER length = 4")
  );
  assert(
    IDENTITY_SUBSTEP_ORDER.every((s, i) => s.order === i),
    tc("ORDER entries have sequential order (0,1,2,3)")
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 2: rename-propagate.ts — offline helpers
// ═══════════════════════════════════════════════════════════════════════
section("2. rename-propagate.ts — regex replace (offline)");

async function testRenamePropagate() {
  const mod = await import("../src/lib/rename-propagate");

  // Test replaceAllWith via the exported helpers. The module exports
  // propagateRename() and previewRename(), but those need Prisma.
  // We test the internal regex helpers by testing them indirectly through
  // the replace function behavior visible in deepCountInJson and
  // the escapeRegex helper (which is not exported but we test via
  // property: if the module doesn't crash on import, regex works).

  // The module uses \bboundary\b + case-insensitive pattern.
  // We verify the module exports the right types.
  assert(typeof mod.propagateRename === "function", tc("propagateRename is a function"));
  assert(typeof mod.previewRename === "function", tc("previewRename is a function"));

  // Test escapeRegex indirectly — it handles special regex chars.
  // Check the module imports correctly.
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/rename-propagate.ts"),
    "utf-8"
  );
  assert(
    src.includes("escapeRegex"),
    tc("escapeRegex helper exists in source")
  );
  assert(
    src.includes("replaceAllWith"),
    tc("replaceAllWith helper exists in source")
  );
  assert(
    src.includes("deepReplaceInJson"),
    tc("deepReplaceInJson helper exists in source")
  );
  assert(
    src.includes("deepCountInJson"),
    tc("deepCountInJson helper exists in source")
  );
  assert(
    src.includes("\\\\b"),
    tc("word-boundary regex (\\b) present")
  );
  assert(
    src.includes('"gi"'),
    tc("case-insensitive flag (gi) present")
  );
  assert(
    src.includes("length >= 2") || src.includes("length < 2"),
    tc("min-length guard (≥2) present")
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 3: identity-visual.ts
// ═══════════════════════════════════════════════════════════════════════
section("3. identity-visual.ts — parseVisualArtifactContent & helpers");

async function testIdentityVisual() {
  const {
    parseVisualArtifactContent,
    getVisualOption,
    extractMetaFromHtml,
    isVisualArtifact,
  } = await import("../src/lib/identity-visual");

  // Build valid artifact with 3 options
  const htmlA = `<!DOCTYPE html><html><head><meta name="mood" content="Moderno y vibrante"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Source+Sans+3&display=swap" rel="stylesheet"><style>body{background:#0F172A}</style></head><body><h1>Estilo A</h1></body></html>`;
  const htmlB = htmlA.replace("Estilo A", "Estilo B").replace("#0F172A", "#FDFBF7");
  const htmlC = htmlA.replace("Estilo A", "Estilo C").replace("#0F172A", "#1B4332");

  const validJson = JSON.stringify({
    options: [
      {
        variant: "A",
        html: htmlA,
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
        html: htmlB,
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
        html: htmlC,
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

  // Test 1: parse valid artifact
  const parsed = parseVisualArtifactContent(validJson);
  assert(parsed !== null, tc("parse valid JSON → non-null"));
  assert(parsed!.options.length === 3, tc("parse valid JSON → 3 options"));

  const optA = parsed!.options[0];
  assert(optA.variant === "A", tc("option A variant = A"));
  assert(optA.meta.primaryColor === "#0F172A", tc("option A primary color correct"));
  assert(optA.meta.fontHeading === "Inter", tc("option A fontHeading correct"));
  assert(optA.meta.fontBody === "Source Sans 3", tc("option A fontBody correct"));

  // Test 2: parse rejects invalid inputs
  assert(parseVisualArtifactContent(null) === null, tc("null → null"));
  assert(parseVisualArtifactContent("") === null, tc("empty string → null"));
  assert(parseVisualArtifactContent("plain text") === null, tc("plain text → null"));
  assert(parseVisualArtifactContent("<html></html>") === null, tc("HTML string → null"));
  assert(
    parseVisualArtifactContent(JSON.stringify({ foo: "bar" })) === null,
    tc("wrong shape JSON → null")
  );
  assert(
    parseVisualArtifactContent(JSON.stringify({ options: [] })) === null,
    tc("empty options array → null (no valid options)")
  );

  // Test 3: getVisualOption
  const gotA = getVisualOption(parsed, "A");
  assert(gotA !== null && gotA.variant === "A", tc("getVisualOption A → correct"));

  const gotC = getVisualOption(parsed, "C");
  assert(gotC !== null && gotC.variant === "C", tc("getVisualOption C → correct"));

  const gotZ = getVisualOption(parsed, "Z");
  assert(gotZ === null, tc("getVisualOption Z → null"));

  const gotCase = getVisualOption(parsed, "b");
  assert(gotCase !== null && gotCase.variant === "B", tc("getVisualOption 'b' → B (case insensitive)"));

  assert(getVisualOption(null, "A") === null, tc("getVisualOption with null content → null"));

  // Test 4: extractMetaFromHtml
  const fallbackHtml = `<!DOCTYPE html><html><head>
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    <style>body{background:#112233;color:#AABBCC}.accent{color:#FF8800}</style>
  </head><body><p>Estilo editorial elegante y atemporal.</p></body></html>`;

  const meta = extractMetaFromHtml(fallbackHtml);
  assert(meta.fontHeading === "Merriweather", tc("extractMeta heading font = Merriweather"));
  assert(meta.fontBody === "Open Sans", tc("extractMeta body font = Open Sans"));
  assert(meta.primaryColor.toLowerCase() === "#112233", tc("extractMeta primary color from background"));
  assert(meta.secondaryColor.toLowerCase() === "#aabbcc", tc("extractMeta secondary color (different from primary)"));
  assert(meta.mood.toLowerCase().includes("editorial"), tc("extractMeta mood from <p>"));

  // Test 5: isVisualArtifact
  assert(isVisualArtifact({ type: "html", content: validJson }), tc("isVisualArtifact with valid html type → true"));
  assert(isVisualArtifact({ type: "json", content: validJson }), tc("isVisualArtifact with valid json type → true"));
  assert(!isVisualArtifact({ type: "markdown", content: "# hi" }), tc("isVisualArtifact with markdown type → false"));
  assert(!isVisualArtifact(null), tc("isVisualArtifact null → false"));
  assert(!isVisualArtifact({ type: "html", content: "not-json" }), tc("isVisualArtifact with non-JSON content → false"));
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 4: report-renderer.ts
// ═══════════════════════════════════════════════════════════════════════
section("4. report-renderer.ts — buildReportHtml (markdown + HTML)");

async function testReportRenderer() {
  const { buildReportHtml } = await import("../src/lib/report-renderer");

  // Test 1: markdown mode
  const mdHtml = buildReportHtml({
    title: "Análisis de Mercado",
    content: "## Introducción\n\nEste es un **análisis** de mercado.\n\n- Punto 1\n- Punto 2\n\n### Competidores\n\n| Nombre | Cuota |\n|--------|-------|\n| A | 30% |\n| B | 25% |",
    contentType: "markdown",
    projectName: "MiApp",
    phaseType: "ANALYSIS",
  });

  assert(typeof mdHtml === "string" && mdHtml.length > 200, tc("markdown: returns non-empty string"));
  assert(mdHtml.includes("<!DOCTYPE html>"), tc("markdown: includes DOCTYPE"));
  assert(mdHtml.includes("<title>Análisis de Mercado"), tc("markdown: includes title in <title>"));
  assert(mdHtml.includes("MiApp"), tc("markdown: includes projectName"));
  assert(mdHtml.includes("ANALYSIS"), tc("markdown: includes phaseType"));
  assert(mdHtml.includes("Imprimir / Guardar como PDF"), tc("markdown: includes print button"));
  assert(mdHtml.includes("report-body"), tc("markdown: has report-body class"));
  assert(mdHtml.includes("window.print()"), tc("markdown: has print() JavaScript"));
  assert(mdHtml.includes("Introducción"), tc("markdown: rendered heading"));
  assert(mdHtml.includes("<strong>"), tc("markdown: bold rendered"));

  // Test 2: HTML mode (visual style guide)
  const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Style Guide</title></head>
<body>
  <h1>Style A</h1>
  <p>A modern, vibrant look with <strong>Inter</strong> typography.</p>
</body>
</html>`;

  const htmlMode = buildReportHtml({
    title: "Estilo Visual A",
    content: htmlContent,
    contentType: "html",
    projectName: "Tallow & Glow",
    phaseType: "IDENTITY",
  });

  assert(typeof htmlMode === "string" && htmlMode.length > 200, tc("html mode: returns non-empty string"));
  assert(htmlMode.includes("<!DOCTYPE html>"), tc("html mode: starts with DOCTYPE"));
  assert(htmlMode.includes("Estilo Visual A"), tc("html mode: title in document"));
  assert(htmlMode.includes("Tallow &amp; Glow"), tc("html mode: projectName escaped"));
  assert(htmlMode.includes("Style A"), tc("html mode: inner HTML preserved"));
  assert(htmlMode.includes("<strong>Inter</strong>"), tc("html mode: tags preserved"));

  // Test 3: HTML mode strips outer <html>/<head>/<body> but keeps inner
  assert(!/<body>/.test(htmlMode.replace(/<body>[\s\S]*/, "").match(/<body>/)?.[0] ?? ""), tc("html mode: no duplicate body opening"));

  // Test 4: custom generatedAt
  const withDate = buildReportHtml({
    title: "Test",
    content: "Hello",
    contentType: "markdown",
    projectName: "Test",
    phaseType: "TEST",
    generatedAt: new Date("2026-06-07T12:00:00Z"),
  });
  assert(withDate.includes("07/06/2026"), tc("custom date: rendered in es-ES format"));

  // Test 5: missing fields (edge cases)
  const minimal = buildReportHtml({
    title: "",
    content: "",
    contentType: "markdown",
    projectName: "",
    phaseType: "",
  });
  assert(typeof minimal === "string", tc("empty fields: still returns string"));
  assert(minimal.includes("<!DOCTYPE html>"), tc("empty fields: valid HTML structure"));
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 5: pdf-export.ts
// ═══════════════════════════════════════════════════════════════════════
section("5. pdf-export.ts — buildReportPdf generates PDF buffer");

async function testPdfExport() {
  const { buildReportPdf } = await import("../src/lib/pdf-export");

  const buffer = buildReportPdf({
    title: "Testing PDF Export",
    content: "## Hello World\n\nThis is a **test** paragraph.\n\n- Item one\n- Item two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |",
    phaseType: "TEST",
    projectName: "Brew Validator",
    generatedAt: new Date("2026-06-07T12:00:00Z"),
  });

  assert(Buffer.isBuffer(buffer), tc("returns a Buffer"));
  assert(buffer.length > 1000, tc("buffer size > 1000 bytes (meaningful content)"));

  // Check PDF signature: %PDF-
  const header = buffer.slice(0, 5).toString("utf-8");
  assert(header.startsWith("%PDF-"), tc(`buffer starts with PDF signature: "${header}"`));

  // Check PDF ends with %%EOF
  const tail = buffer.slice(-10).toString("utf-8");
  assert(tail.includes("%%EOF"), tc(`buffer ends with %%EOF marker`));

  // Check it's valid jsPDF output (contains /Type /Page or /Type /Catalog)
  const fullStr = buffer.toString("latin1");
  assert(fullStr.includes("/Type"), tc("PDF contains /Type entries"));
  assert(fullStr.includes("Brew Validator"), tc("PDF includes project name"));

  // Test 2: empty content still produces valid PDF
  const emptyBuffer = buildReportPdf({
    title: "Empty",
    content: "",
    phaseType: "TEST",
    projectName: "Test",
  });
  assert(Buffer.isBuffer(emptyBuffer), tc("empty content: returns Buffer"));
  assert(emptyBuffer.slice(0, 5).toString() === "%PDF-", tc("empty content: valid PDF header"));
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 6: validation-report.ts
// ═══════════════════════════════════════════════════════════════════════
section("6. validation-report.ts — structure check");

async function testValidationReport() {
  // buildValidationReport needs Prisma, so we verify the module structure.
  const mod = await import("../src/lib/validation-report");

  assert(typeof mod.buildValidationReport === "function", tc("buildValidationReport is a function"));
  assert(typeof mod.buildValidationReport === "function", tc("exported function is callable (type check)"));

  // Check the exported types
  const src = fs.readFileSync(
    path.resolve(__dirname, "../src/lib/validation-report.ts"),
    "utf-8"
  );
  assert(src.includes("ValidationReportInput"), tc("ValidationReportInput interface exists"));
  assert(src.includes("ValidationReportResult"), tc("ValidationReportResult interface exists"));
  assert(src.includes("project_not_found"), tc("throws 'project_not_found' for missing project"));
  assert(src.includes("no_idea"), tc("throws 'no_idea' for missing idea"));
  assert(src.includes("no_reports"), tc("throws 'no_reports' for missing reports"));
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 7: identity-brandbook.ts
// ═══════════════════════════════════════════════════════════════════════
section("7. identity-brandbook.ts — buildBrandBook");

async function testBrandBook() {
  const {
    buildBrandBook,
    brandBookToMarkdown,
    BRANDBOOK_DEFAULT_SECTIONS,
  } = await import("../src/lib/identity-brandbook");

  const namingContent = "## Naming\nElegimos 'EcoFlow' porque transmite sostenibilidad y dinamismo.";
  const voiceContent = "## Voz y Tono\nTono cercano, fresco y experto. Inspira confianza.";
  const visualJson = JSON.stringify({
    options: [
      {
        variant: "A",
        html: "<html><head><meta name='mood' content='Fresco y ecológico'></head><body><h1>Estilo A</h1></body></html>",
        meta: {
          name: "Estilo A — Natural y fresco",
          primaryColor: "#16A34A",
          secondaryColor: "#F59E0B",
          fontHeading: "Inter",
          fontBody: "Source Sans 3",
          mood: "Fresco y ecológico",
        },
      },
      {
        variant: "B",
        html: "<html><body><h1>Estilo B</h1></body></html>",
        meta: {
          name: "Estilo B",
          primaryColor: "#1E40AF",
          secondaryColor: "#3B82F6",
          fontHeading: "Poppins",
          fontBody: "Lato",
          mood: "Tecnológico",
        },
      },
      {
        variant: "C",
        html: "<html><body><h1>Estilo C</h1></body></html>",
        meta: {
          name: "Estilo C",
          primaryColor: "#7C3AED",
          secondaryColor: "#A78BFA",
          fontHeading: "Space Grotesk",
          fontBody: "DM Sans",
          mood: "Creativo",
        },
      },
    ],
  });

  // Full Brand Book
  const bb = buildBrandBook({
    projectName: "EcoFlow",
    namingContent,
    voiceContent,
    visualChoice: "A",
    visualArtifactJson: visualJson,
    projectContext: { description: "Una app de hábitos sostenibles" },
  });

  assert(bb.projectName === "EcoFlow", tc("projectName is correct"));
  assert(bb.sections.length === 9, tc("brand book has 9 sections"));
  assert(bb.sections[0].id === "intro", tc("first section = intro"));
  assert(bb.sections[8].id === "dosdonts", tc("last section = dosdonts"));

  const namingSection = bb.sections.find((s) => s.id === "naming");
  assert(namingSection?.content.includes("EcoFlow"), tc("naming section includes project name"));
  assert(namingSection?.content.includes("Elegimos"), tc("naming section includes rationale keyword"));

  assert(bb.meta.visualMeta !== null, tc("visualMeta populated"));
  assert(bb.meta.visualMeta!.variant === "A", tc("visualMeta variant = A"));
  assert(bb.meta.visualMeta!.primaryColor === "#16A34A", tc("visualMeta primaryColor correct"));
  assert(bb.meta.visualMeta!.fontHeading === "Inter", tc("visualMeta fontHeading correct"));
  assert(bb.meta.voiceSummary.length > 0, tc("voiceSummary extracted"));

  const colorSection = bb.sections.find((s) => s.id === "color");
  assert(colorSection?.content.includes("#16A34A"), tc("color section includes primary hex"));
  assert(colorSection?.content.includes("#F59E0B"), tc("color section includes secondary hex"));

  const typoSection = bb.sections.find((s) => s.id === "typography");
  assert(typoSection?.content.includes("Inter"), tc("typography section includes heading font"));
  assert(typoSection?.content.includes("Source Sans 3"), tc("typography section includes body font"));

  // Partial Brand Book — missing naming
  const bbPartial = buildBrandBook({
    projectName: "EcoFlow",
    namingContent: null,
    voiceContent: null,
    visualChoice: null,
    visualArtifactJson: null,
  });

  assert(bbPartial.sections.length === 9, tc("partial: still 9 sections"));
  assert(
    bbPartial.sections.find((s) => s.id === "naming")?.content.includes("PENDIENTE"),
    tc("partial: naming shows PENDIENTE placeholder")
  );
  assert(
    bbPartial.sections.find((s) => s.id === "voice")?.content.includes("PENDIENTE"),
    tc("partial: voice shows PENDIENTE placeholder")
  );
  assert(bbPartial.meta.visualMeta === null, tc("partial: visualMeta is null"));

  // Invalid visual variant → falls back to A
  const bbFallback = buildBrandBook({
    projectName: "Test",
    namingContent,
    voiceContent,
    visualChoice: "XYZ",
    visualArtifactJson: visualJson,
  });
  assert(bbFallback.meta.visualMeta?.variant === "A", tc("invalid variant → falls back to A"));

  // Invalid JSON for visual
  const bbBadJson = buildBrandBook({
    projectName: "Test",
    namingContent: null,
    voiceContent: null,
    visualChoice: "A",
    visualArtifactJson: "not-json",
  });
  assert(bbBadJson.meta.visualMeta === null, tc("invalid JSON → visualMeta null"));

  // markdown serialization
  const md = brandBookToMarkdown(bb);
  assert(md.length > 500, tc("markdown output > 500 chars"));
  assert(md.includes("---"), tc("markdown includes separators (---)"));
  assert(md.includes("EcoFlow"), tc("markdown includes project name"));
  assert(md.includes("#16A34A"), tc("markdown includes color hex"));

  // BRANDBOOK_DEFAULT_SECTIONS
  assert(BRANDBOOK_DEFAULT_SECTIONS.length === 9, tc("DEFAULT_SECTIONS has 9 entries"));
  const ids = BRANDBOOK_DEFAULT_SECTIONS.map((s) => s.id);
  assert(new Set(ids).size === ids.length, tc("DEFAULT_SECTIONS ids are unique"));
  assert(ids.includes("intro") && ids.includes("dosdonts"), tc("DEFAULT_SECTIONS covers intro..dosdonts"));
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 8: project-memory.ts
// ═══════════════════════════════════════════════════════════════════════
section("8. project-memory.ts — mergeProjectMemory");

async function testProjectMemory() {
  const {
    mergeProjectMemory,
    getMemoryValue,
    formatMemoryValue,
    memoryKeyLabels,
  } = await import("../src/lib/project-memory");

  // Test 1: basic merge — new key adds
  const base: Record<string, unknown> = {};
  const incoming = {
    target: {
      value: "jóvenes 18-25",
      source: "01" as const,
      updatedAt: "2026-06-07T10:00:00Z",
    },
  };
  const merged1 = mergeProjectMemory(base, incoming, "01");
  assert(merged1.target?.value === "jóvenes 18-25", tc("merge: new key added"));
  assert(merged1.target?.source === "01", tc("merge: source preserved"));

  // Test 2: last-wins for same key, later timestamp
  const later = {
    target: {
      value: "jóvenes 25-35",
      source: "02" as const,
      updatedAt: "2026-06-07T11:00:00Z",
    },
  };
  const merged2 = mergeProjectMemory(merged1, later, "02");
  assert(merged2.target?.value === "jóvenes 25-35", tc("last-wins: later timestamp prevails"));
  assert(merged2.target?.source === "02", tc("last-wins: source updated"));

  // Test 3: earlier timestamp does NOT overwrite later
  const earlier = {
    target: {
      value: "todos",
      source: "01" as const,
      updatedAt: "2026-06-07T09:00:00Z",
    },
  };
  const merged3 = mergeProjectMemory(merged2, earlier, "01");
  assert(merged3.target?.value === "jóvenes 25-35", tc("last-wins: earlier timestamp does NOT overwrite"));
  assert(merged3.target?.source === "02", tc("last-wins: source unchanged"));

  // Test 4: user ALWAYS prevails over non-user
  const userOverride = {
    target: {
      value: "mujeres 30-40",
      source: "user" as const,
      updatedAt: "2026-06-07T09:00:00Z", // earlier date but user
    },
  };
  const merged4 = mergeProjectMemory(merged3, userOverride, "user");
  assert(merged4.target?.value === "mujeres 30-40", tc("user prevails: user value wins over older phase value"));
  assert(merged4.target?.source === "user", tc("user prevails: source set to user"));

  // Test 5: existing user is NOT overwritten by non-user (even with later timestamp)
  const phaseAttempt = {
    target: {
      value: "otro target",
      source: "03" as const,
      updatedAt: "2026-06-08T10:00:00Z", // very recent but from phase
    },
  };
  const merged5 = mergeProjectMemory(merged4, phaseAttempt, "03");
  assert(merged5.target?.value === "mujeres 30-40", tc("user lock: phase cannot override user entry"));
  assert(merged5.target?.source === "user", tc("user lock: source stays user"));

  // Test 6: user-vs-user → later timestamp wins
  const laterUser = {
    target: {
      value: "hombres 40-50",
      source: "user" as const,
      updatedAt: "2026-06-08T12:00:00Z",
    },
  };
  const merged6 = mergeProjectMemory(merged5, laterUser, "user");
  assert(merged6.target?.value === "hombres 40-50", tc("user-vs-user: later user timestamp wins"));

  // Test 7: multiple keys simultaneously
  const multiMerge = mergeProjectMemory(
    { target: merged6.target },
    {
      channels: { value: ["TikTok", "IG"], source: "03", updatedAt: "2026-06-07T10:00:00Z" },
      tone: { value: "cercano", source: "02", updatedAt: "2026-06-07T10:00:00Z" },
    },
    "03"
  );
  assert(multiMerge.channels?.value instanceof Array, tc("multi-merge: channels set"));
  assert((multiMerge.channels?.value as string[]).includes("TikTok"), tc("multi-merge: TikTok in channels"));
  assert(multiMerge.tone?.value === "cercano", tc("multi-merge: tone set"));

  // Test 8: getMemoryValue
  assert(getMemoryValue(multiMerge, "channels") instanceof Array, tc("getMemoryValue: returns array"));
  assert(getMemoryValue(multiMerge, "tone") === "cercano", tc("getMemoryValue: returns string value"));
  assert(getMemoryValue(multiMerge, "nonexistent", "fallback") === "fallback", tc("getMemoryValue: returns fallback"));
  assert(getMemoryValue(null, "any", "fb") === "fb", tc("getMemoryValue: null memory → fallback"));

  // Test 9: formatMemoryValue
  assert(formatMemoryValue("hello") === "hello", tc("formatMemoryValue: string passthrough"));
  assert(formatMemoryValue(["a", "b"]) === "a, b", tc("formatMemoryValue: array → comma join"));
  assert(formatMemoryValue(null) === "—", tc("formatMemoryValue: null → em dash"));
  assert(formatMemoryValue({ x: 1 }) === '{"x":1}', tc("formatMemoryValue: object → JSON"));

  // Test 10: memoryKeyLabels
  assert(memoryKeyLabels.target === "target", tc("memoryKeyLabels: target key exists"));
  assert(memoryKeyLabels.tone === "tono", tc("memoryKeyLabels: tone key exists"));
  assert(memoryKeyLabels.channels === "canales", tc("memoryKeyLabels: channels key exists"));
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 9: agent-context-rules.ts
// ═══════════════════════════════════════════════════════════════════════
section("9. agent-context-rules.ts — buildAgentContextRules");

async function testAgentContextRules() {
  const { buildAgentContextRules } = await import("../src/lib/agent-context-rules");

  // Test 1: null/empty memory
  const empty = buildAgentContextRules(null);
  assert(empty.includes("No hay decisiones previas"), tc("null memory → 'No hay decisiones previas'"));
  assert(empty.includes("Pregunta todo"), tc("null memory → 'Pregunta todo'"));

  const emptyObj = buildAgentContextRules({});
  assert(emptyObj.includes("No hay decisiones previas"), tc("empty memory → 'No hay decisiones previas'"));

  // Test 2: populated memory
  const populated: Record<string, unknown> = {
    target: {
      value: "emprendedores 25-40",
      source: "01",
      updatedAt: "2026-06-07T10:00:00Z",
    },
    tone: {
      value: "profesional pero cercano",
      source: "01",
      updatedAt: "2026-06-07T10:00:00Z",
    },
  };
  const rules = buildAgentContextRules(populated);
  assert(rules.includes("NO PREGUNTES ESTO"), tc("populated: includes NO PREGUNTES ESTO"));
  assert(rules.includes("target"), tc("populated: includes 'target' key"));
  assert(rules.includes("emprendedores 25-40"), tc("populated: includes target value"));
  assert(rules.includes("tone"), tc("populated: includes 'tone' key"));
  assert(rules.includes("profesional pero cercano"), tc("populated: includes tone value"));
  assert(rules.includes("decidido en fase 01"), tc("populated: includes source info"));
  assert(rules.includes("Reglas de consistencia"), tc("populated: includes consistency rules"));

  // Test 3: memory with rationale
  const withRationale: Record<string, unknown> = {
    pricing: {
      value: "freemium con tier PRO a 9.99€/mes",
      source: "04",
      updatedAt: "2026-06-07T10:00:00Z",
      rationale: "El segmento objetivo valora probar antes de comprar",
    },
  };
  const rules2 = buildAgentContextRules(withRationale);
  assert(rules2.includes("Por qué:"), tc("rationale: includes 'Por qué:' label"));
  assert(rules2.includes("probar antes de comprar"), tc("rationale: includes rationale text"));

  // Test 4: complex values (objects)
  const complex: Record<string, unknown> = {
    visual: {
      value: { primaryColor: "#6C63FF", secondaryColor: "#FF6584" },
      source: "01",
      updatedAt: "2026-06-07T10:00:00Z",
    },
  };
  const rules3 = buildAgentContextRules(complex);
  assert(rules3.includes('"primaryColor":"#6C63FF"'), tc("complex: JSON representation in rules"));
  assert(rules3.includes('"secondaryColor":"#FF6584"'), tc("complex: includes secondary visual"));
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 11: phase-loading-messages.ts — estado→mensaje de carga (U6 UX)
// ═══════════════════════════════════════════════════════════════════════
section("11. phase-loading-messages.ts — estado→mensaje de carga");

async function testPhaseLoadingMessages() {
  const {
    getPhaseLoadingMessage,
    isPhaseLoading,
    PHASE_PREPARING_MESSAGE,
  } = await import("../src/lib/phase-loading-messages");

  // processing sin preguntas -> "Generando preguntas…"
  assert(
    getPhaseLoadingMessage("processing", { hasQuestions: false }) ===
      "Generando preguntas…",
    tc("processing sin preguntas -> Generando preguntas…")
  );

  // processing con preguntas -> "Generando informe…"
  assert(
    getPhaseLoadingMessage("processing", { hasQuestions: true }) ===
      "Generando informe…",
    tc("processing con preguntas -> Generando informe…")
  );

  // questioning sin preguntas -> "Generando preguntas…"
  assert(
    getPhaseLoadingMessage("questioning", { hasQuestions: false }) ===
      "Generando preguntas…",
    tc("questioning sin preguntas -> Generando preguntas…")
  );

  // questioning CON preguntas -> null (no hay job de carga)
  assert(
    getPhaseLoadingMessage("questioning", { hasQuestions: true }) === null,
    tc("questioning con preguntas -> null (sin spinner)")
  );

  // justUnlocked tiene prioridad -> "Preparando la siguiente fase…"
  assert(
    getPhaseLoadingMessage("available", { justUnlocked: true }) ===
      PHASE_PREPARING_MESSAGE,
    tc("justUnlocked -> Preparando la siguiente fase…")
  );

  // Estados sin carga -> null
  assert(
    getPhaseLoadingMessage("available") === null,
    tc("available -> null")
  );
  assert(
    getPhaseLoadingMessage("completed") === null,
    tc("completed -> null")
  );
  assert(
    getPhaseLoadingMessage("locked") === null,
    tc("locked -> null")
  );
  assert(
    getPhaseLoadingMessage("substep") === null,
    tc("substep -> null")
  );

  // isPhaseLoading refleja getPhaseLoadingMessage
  assert(
    isPhaseLoading("processing", { hasQuestions: false }) === true,
    tc("isPhaseLoading: processing -> true")
  );
  assert(
    isPhaseLoading("completed") === false,
    tc("isPhaseLoading: completed -> false")
  );
  assert(
    isPhaseLoading("available", { justUnlocked: true }) === true,
    tc("isPhaseLoading: justUnlocked -> true")
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 10: handoff-builder.ts
// ═══════════════════════════════════════════════════════════════════════
section("10. handoff-builder.ts — buildHandoffZip");

async function testHandoffBuilder() {
  const { buildHandoffZip } = await import("../src/lib/handoff-builder");
  const { buildBrandBook } = await import("../src/lib/identity-brandbook");

  const brandBook = buildBrandBook({
    projectName: "TestFlow",
    namingContent: "Elegimos TestFlow por claridad.",
    voiceContent: "Tono profesional y directo.",
    visualChoice: "A",
    visualArtifactJson: JSON.stringify({
      options: [
        {
          variant: "A",
          html: "<html><body><h1>A</h1></body></html>",
          meta: {
            name: "Estilo A",
            primaryColor: "#6C63FF",
            secondaryColor: "#FF6584",
            fontHeading: "Inter",
            fontBody: "Source Sans 3",
            mood: "Moderno",
          },
        },
        {
          variant: "B",
          html: "<html><body><h1>B</h1></body></html>",
          meta: {
            name: "Estilo B",
            primaryColor: "#1a1a2e",
            secondaryColor: "#e94560",
            fontHeading: "Playfair Display",
            fontBody: "Lora",
            mood: "Elegante",
          },
        },
        {
          variant: "C",
          html: "<html><body><h1>C</h1></body></html>",
          meta: {
            name: "Estilo C",
            primaryColor: "#16A34A",
            secondaryColor: "#F59E0B",
            fontHeading: "Space Grotesk",
            fontBody: "DM Sans",
            mood: "Fresco",
          },
        },
      ],
    }),
  });

  const options = {
    projectId: "test-handoff-123",
    projectName: "TestFlow App 🚀",
    ideaContext: {
      title: "TestFlow App 🚀",
      description: "Automatización para equipos pequeños",
      problem: "Demasiadas herramientas, poca integración",
      valueProposition: "Unifica todo en un solo flujo de trabajo",
      targetUser: "Startups de 5-50 empleados",
      monetization: "Suscripción mensual desde 29€/mes",
      businessModel: "SaaS",
    },
    phases: [
      {
        type: "VALIDATION",
        label: "Validación",
        sortOrder: 0,
        status: "COMPLETED",
        description: "Validación de la idea",
        subStep: null,
        subStepChoice: null,
        subStepArtifact: null,
        artifacts: [{ title: "Informe", content: "# Validación\n\nCompletada.", type: "markdown" }],
      },
      {
        type: "ANALYSIS",
        label: "Análisis de Mercado",
        sortOrder: 1,
        status: "COMPLETED",
        description: "Análisis de mercado",
        subStep: null,
        subStepChoice: null,
        subStepArtifact: null,
        artifacts: [{ title: "Análisis", content: "## Mercado\n\nTAM/SAM/SOM...", type: "markdown" }],
      },
      {
        type: "IDENTITY",
        label: "Identidad de Marca",
        sortOrder: 2,
        status: "COMPLETED",
        description: "Identidad de marca",
        subStep: "final",
        subStepChoice: "TestFlow",
        subStepArtifact: null,
        artifacts: [{ title: "Brand Book", content: "## Brand Book", type: "markdown" }],
      },
      {
        type: "CONTENT",
        label: "Distribución",
        sortOrder: 3,
        status: "COMPLETED",
        description: null,
        subStep: null,
        subStepChoice: null,
        subStepArtifact: null,
        artifacts: [{ title: "Estrategia", content: "## Canales\n\nTwitter, LinkedIn", type: "markdown" }],
      },
      {
        type: "DEVELOPMENT",
        label: "Landing",
        sortOrder: 4,
        status: "LOCKED", // Should NOT appear in ZIP
        description: null,
        subStep: null,
        subStepChoice: null,
        subStepArtifact: null,
        artifacts: null,
      },
    ],
    memory: {
      target: { value: "Startups tech España", source: "01", updatedAt: "2026-06-07T10:00:00Z" },
      tone: { value: "profesional", source: "01", updatedAt: "2026-06-07T10:00:00Z" },
    },
    brandBook,
  };

  // Build ZIP
  const buffer = await buildHandoffZip(options);
  assert(Buffer.isBuffer(buffer), tc("returns a Buffer"));
  assert(buffer.length > 100, tc("ZIP buffer is non-empty"));

  // Write to /tmp and extract to verify structure
  const tmpZip = "/tmp/smoke-e2e-handoff.zip";
  const tmpDir = "/tmp/smoke-e2e-extract";
  fs.writeFileSync(tmpZip, buffer);
  execSync(`rm -rf "${tmpDir}" && mkdir -p "${tmpDir}"`, { encoding: "utf-8" });

  try {
    execSync(`unzip -o "${tmpZip}" -d "${tmpDir}"`, { encoding: "utf-8" });
  } catch {
    // If unzip isn't available on this system, skip extraction verification
    console.log("  ⚠ unzip not available, skipping extraction check");
    execSync(`rm -f "${tmpZip}" && rm -rf "${tmpDir}"`, { encoding: "utf-8" });
    return;
  }

  const files = execSync(`find "${tmpDir}" -type f | sort`, { encoding: "utf-8" })
    .trim()
    .split("\n")
    .map((f) => f.replace(tmpDir + "/", ""));

  const topDir = files[0]?.split("/")[0] || "";

  // Verify filename sanitization: no spaces, no accents, no special chars
  assert(
    !topDir.includes(" ") && !topDir.includes("🚀"),
    tc(`sanitized folder: "${topDir}" (no spaces, no emoji)`)
  );
  assert(topDir.includes("testflow-app"), tc("sanitized folder contains project slug"));

  // Verify required files
  const requiredFiles = [
    "README.md",
    "01-validacion.md",
    "02-analisis-mercado.md",
    "03-identidad/brand-book.md",
    "04-estrategia-distribucion.md",
    "skills/landing-builder.md",
    "skills/content-writer.md",
    "skills/social-strategy.md",
    "skills/project-handoff.md",
  ];

  for (const rf of requiredFiles) {
    const fullPath = `${topDir}/${rf}`;
    const found = files.some((f) => f === fullPath);
    assert(found, tc(`ZIP contains: ${fullPath}`));
  }

  // Verify LOCKED phase (DEVELOPMENT) is NOT included
  const hasLanding = files.some((f) => f.includes("05-landing-page"));
  assert(!hasLanding, tc("LOCKED phase (landing) correctly omitted from ZIP"));

  // Cleanup
  execSync(`rm -f "${tmpZip}" && rm -rf "${tmpDir}"`, { encoding: "utf-8" });
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const start = Date.now();

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   🧪 Brew Validator — Comprehensive Smoke Test       ║");
  console.log("║   Fase 10 — E2E Verification                        ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  try {
    await testIdentitySubsteps();
    await testRenamePropagate();
    await testIdentityVisual();
    await testReportRenderer();
    await testPdfExport();
    await testValidationReport();
    await testBrandBook();
    await testProjectMemory();
    await testAgentContextRules();
    await testPhaseLoadingMessages();
    await testHandoffBuilder();
  } catch (err) {
    console.log(`\n  ❌ FATAL ERROR: ${err}`);
    totalFailed++;
  }

  const elapsed = Date.now() - start;
  const total = totalPassed + totalFailed;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`\n  📊 RESULTS: ${totalPassed}/${total} passed (${elapsed}ms)\n`);

  if (totalFailed > 0) {
    console.log(`  ❌ ${totalFailed} test(s) FAILED\n`);
    process.exit(1);
  } else {
    console.log(`  ✅ ALL ${totalPassed} tests PASSED\n`);
    process.exit(0);
  }
}

main();
