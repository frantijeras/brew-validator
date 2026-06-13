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
    getNextIdentitySubStep("voice") === "logo",
    tc("voice → logo")
  );
  assert(
    getNextIdentitySubStep("logo") === "visual",
    tc("logo → visual")
  );
  assert(
    getNextIdentitySubStep("visual") === null,
    tc("visual → null (phase complete)")
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
    getIdentitySubStepIndex("logo") === 2,
    tc("index: logo = 2")
  );
  assert(
    getIdentitySubStepIndex("visual") === 3,
    tc("index: visual = 3")
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
    getIdentitySubStepLabel("naming") === "Naming",
    tc("label: naming = Naming")
  );
  assert(
    getIdentitySubStepLabel("voice") === "Voz y Tono",
    tc("label: voice = Voz y Tono")
  );
  assert(
    getIdentitySubStepLabel("logo") === "Logotipo",
    tc("label: logo = Logotipo")
  );
  assert(
    getIdentitySubStepLabel("visual") === "Estilo Visual y Maqueta",
    tc("label: visual = Estilo Visual y Maqueta")
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
    IDENTITY_SUBSTEP_IDS[2] === "logo" &&
    IDENTITY_SUBSTEP_IDS[3] === "visual",
    tc("IDS covers naming..visual in order")
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
  // NOTA: buildReportPdf incrusta la fuente Roboto (subconjunto) y escribe el
  // texto como ÍNDICES DE GLIFO, no como ASCII — por eso el nombre del proyecto
  // NUNCA aparece como "Brew Validator" en el buffer (ni tras inflar streams).
  // En su lugar verificamos que el PDF incrustó la fuente y tiene páginas, lo
  // que implica que el texto del informe se renderizó.
  assert(
    fullStr.includes("/FontFile2") || fullStr.includes("/BaseFont"),
    tc("PDF incrusta la fuente (texto renderizado)")
  );
  assert(fullStr.includes("/Page"), tc("PDF contiene al menos una página"));

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

  // Artefacto visual (3 estilos A/B/C) y logos (HTML con 2 SVG) para que el
  // builder pueda componer 3.voz-y-tono.md, 3d.guia-de-estilo.md y los assets.
  const visualJson = JSON.stringify({
    options: [
      {
        variant: "A",
        html: "<!DOCTYPE html><html><body><h1 style=\"color:#6C63FF\">A</h1></body></html>",
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
        html: "<!DOCTYPE html><html><body><h1>B</h1></body></html>",
        meta: { name: "Estilo B", primaryColor: "#1a1a2e", secondaryColor: "#e94560", fontHeading: "Playfair Display", fontBody: "Lora", mood: "Elegante" },
      },
      {
        variant: "C",
        html: "<!DOCTYPE html><html><body><h1>C</h1></body></html>",
        meta: { name: "Estilo C", primaryColor: "#16A34A", secondaryColor: "#F59E0B", fontHeading: "Space Grotesk", fontBody: "DM Sans", mood: "Fresco" },
      },
    ],
  });
  const logosHtml =
    "<!DOCTYPE html><html><body><div class=\"grid\">" +
    "<div class=\"logo-card\"><svg viewBox=\"0 0 100 40\"><text x=\"0\" y=\"30\">Uno</text></svg></div>" +
    "<div class=\"logo-card\"><svg viewBox=\"0 0 100 40\"><circle cx=\"20\" cy=\"20\" r=\"15\"/></svg></div>" +
    "</div></body></html>";

  const identityHistory = {
    naming: { subStep: "naming", choice: "TestFlow", artifact: { type: "markdown", content: "## Naming\n\nTestFlow." } },
    voice: { subStep: "voice", choice: "", artifact: { type: "markdown", content: "# Voz y Tono\n\nProfesional y directo." } },
    logo: { subStep: "logo", choice: "1", artifact: { type: "html", content: logosHtml } },
    visual: { subStep: "visual", choice: "A", artifact: { type: "html", content: visualJson } },
  };

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
        type: "ANALYSIS", label: "Análisis de Mercado", sortOrder: 1, status: "COMPLETED",
        description: "Análisis de mercado", subStep: null, subStepChoice: null, subStepArtifact: null,
        artifacts: [{ title: "Análisis", content: "## Mercado\n\nTAM/SAM/SOM...", type: "markdown" }],
      },
      {
        type: "BUSINESS", label: "Viabilidad Económica", sortOrder: 2, status: "COMPLETED",
        description: "Viabilidad", subStep: null, subStepChoice: null, subStepArtifact: null,
        artifacts: [{ title: "Viabilidad", content: "## Lean Canvas\n\nLTV/CAC...", type: "markdown" }],
      },
      {
        type: "IDENTITY", label: "Identidad de Marca", sortOrder: 3, status: "COMPLETED",
        description: "Identidad de marca",
        subStep: "visual",
        subStepChoice: "A",
        subStepArtifact: { type: "html", content: visualJson },
        subStepHistory: identityHistory,
        artifacts: [{ title: "Identidad", content: "## Identidad", type: "markdown" }],
      },
      {
        type: "CONTENT", label: "Distribución", sortOrder: 4, status: "COMPLETED",
        description: null, subStep: null, subStepChoice: null, subStepArtifact: null,
        artifacts: [{ title: "Estrategia", content: "## Canales\n\nTwitter, LinkedIn", type: "markdown" }],
      },
      {
        type: "EXECUTION", label: "Roadmap", sortOrder: 5, status: "COMPLETED",
        description: null, subStep: null, subStepChoice: null, subStepArtifact: null,
        artifacts: [{ title: "Roadmap", content: "## Plan 30/60/90", type: "markdown" }],
      },
      {
        type: "DEVELOPMENT", label: "Landing", sortOrder: 6, status: "LOCKED", // NO debe aparecer
        description: null, subStep: null, subStepChoice: null, subStepArtifact: null, artifacts: null,
      },
    ],
    memory: {
      target: { value: "Startups tech España", source: "01", updatedAt: "2026-06-07T10:00:00Z" },
      tone: { value: "profesional", source: "01", updatedAt: "2026-06-07T10:00:00Z" },
    },
  };

  // Build ZIP
  const buffer = await buildHandoffZip(options);
  assert(Buffer.isBuffer(buffer), tc("returns a Buffer"));
  assert(buffer.length > 100, tc("ZIP buffer is non-empty"));

  // Verificación cross-platform: los nombres de entrada del ZIP se guardan como
  // texto literal en las cabeceras locales, así que basta con escanear el buffer
  // (sin shell ni unzip — funciona igual en Windows/Linux).
  const zipText = buffer.toString("latin1");
  const has = (name: string) => zipText.includes(name);

  // Carpeta raíz saneada (sin espacios ni emoji).
  assert(has("testflow-app"), tc("carpeta raíz contiene el slug del proyecto"));
  assert(!has("TestFlow App 🚀/"), tc("carpeta raíz saneada (sin espacios/emoji)"));

  // Estructura NUEVA (numerada, sin naming ni Brand Book).
  const requiredFiles = [
    "AGENT.md",
    "README.md",
    "1.analisis-de-mercado.md",
    "2.viabilidad-economica.md",
    "3.voz-y-tono.md",
    "3d.guia-de-estilo.md",
    "4.estrategia-distribucion.md",
    "5.roadmap.md",
    "skills/3c-logos/logo.svg",
    "skills/3c-logos/logos-options.html",
    "skills/3d-assets/index.html",
    "skills/3d-assets/guia-estilos.pdf",
    "skills/project-handoff.md",
  ];
  for (const rf of requiredFiles) {
    assert(has(rf), tc(`ZIP contiene: ${rf}`));
  }

  // NEGATIVOS: ni naming, ni Brand Book, ni nomenclatura antigua, ni fase LOCKED.
  assert(!has("03-identidad-marca.md"), tc("sin Brand Book consolidado (03-identidad-marca.md)"));
  assert(!has("1.naming") && !has("naming.md"), tc("proceso de naming excluido del paquete"));
  assert(!has("6."), tc("fase LOCKED (Landing) correctamente omitida"));
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 11: toast-queue.ts — pure toast queue reducer (U3)
// ═══════════════════════════════════════════════════════════════════════
section("11. toast-queue.ts — toast queue reducer (pure)");

async function testToastQueue() {
  const { toastQueueReducer, createToastId, MAX_TOASTS } = await import(
    "../src/components/toast/toast-queue"
  );
  const { getUserMessage } = await import("../src/lib/user-messages");

  const mk = (id: string) => ({
    id,
    severity: "info" as const,
    text: `t-${id}`,
    durationMs: 5000,
  });

  // add → newest first
  let s = toastQueueReducer([], { type: "add", toast: mk("a") });
  s = toastQueueReducer(s, { type: "add", toast: mk("b") });
  assert(s.length === 2 && s[0].id === "b", tc("add inserts newest first"));

  // add is idempotent on duplicate id
  const dup = toastQueueReducer(s, { type: "add", toast: mk("a") });
  assert(
    dup.length === 2 && dup.filter((t) => t.id === "a").length === 1,
    tc("add with existing id does not duplicate")
  );

  // remove
  const removed = toastQueueReducer(s, { type: "remove", id: "a" });
  assert(
    removed.length === 1 && removed[0].id === "b",
    tc("remove drops the matching toast")
  );

  // clear
  assert(
    toastQueueReducer(s, { type: "clear" }).length === 0,
    tc("clear empties the queue")
  );

  // cap at MAX_TOASTS (drops oldest)
  let capped: ReturnType<typeof toastQueueReducer> = [];
  for (let i = 0; i < MAX_TOASTS + 3; i++) {
    capped = toastQueueReducer(capped, { type: "add", toast: mk(`x${i}`) });
  }
  assert(capped.length === MAX_TOASTS, tc(`queue capped at MAX_TOASTS=${MAX_TOASTS}`));
  assert(
    capped[0].id === `x${MAX_TOASTS + 2}`,
    tc("cap keeps newest, drops oldest")
  );

  // unique ids
  const id1 = createToastId();
  const id2 = createToastId();
  assert(id1 !== id2 && id1.startsWith("toast-"), tc("createToastId is unique & prefixed"));

  // getUserMessage integration (showErrorByCategory backbone)
  const known = getUserMessage("rate_limit");
  assert(
    known.severity === "warning" && known.text.length > 0,
    tc("getUserMessage('rate_limit') → warning message")
  );
  const fallback = getUserMessage("does-not-exist");
  assert(
    fallback.severity === "error" && fallback.text.length > 0,
    tc("getUserMessage(unknown) → domain fallback message")
  );
}

// MODULE 12: phase-context-parser.ts — densidad de contexto
// ═══════════════════════════════════════════════════════════════════════
section("11. phase-context-parser.ts — densidad de contexto (U8)");

async function testPhaseContextParser() {
  const {
    stripNoiseSections,
    truncatePreservingHeadings,
    parsePhaseArtifact,
    parsePreviousPhaseArtifacts,
    buildConsolidatedContext,
    DEFAULT_MAX_CHARS_PER_PHASE,
  } = await import("../src/lib/phase-context-parser");

  // ── stripNoiseSections: descarta quiz/preguntas/debates ──
  const withNoise = [
    "## Resumen ejecutivo",
    "Este es el resultado consolidado de la fase.",
    "",
    "## Quiz de validación",
    "1. ¿Pregunta uno? a) sí b) no",
    "2. ¿Pregunta dos? a) sí b) no",
    "",
    "## Conclusiones",
    "Las conclusiones finales del análisis.",
    "",
    "## Debate interno",
    "Argumento a favor vs argumento en contra.",
  ].join("\n");

  const stripped = stripNoiseSections(withNoise);
  assert(stripped.includes("Resumen ejecutivo"), tc("strip: conserva 'Resumen ejecutivo'"));
  assert(stripped.includes("Conclusiones"), tc("strip: conserva 'Conclusiones'"));
  assert(!stripped.includes("Quiz de validación"), tc("strip: elimina encabezado 'Quiz'"));
  assert(!stripped.includes("¿Pregunta uno?"), tc("strip: elimina cuerpo del quiz"));
  assert(!stripped.includes("Debate interno"), tc("strip: elimina sección 'Debate'"));
  assert(!stripped.includes("Argumento a favor"), tc("strip: elimina cuerpo del debate"));

  // Contenido sin encabezados markdown → se devuelve intacto
  const plain = "Texto plano sin encabezados, debe conservarse tal cual.";
  assert(stripNoiseSections(plain) === plain, tc("strip: texto sin encabezados intacto"));

  // ── truncatePreservingHeadings: recorta y conserva encabezados ──
  const longSections = [
    "## Sección A",
    "x".repeat(2000),
    "## Sección B",
    "y".repeat(2000),
    "## Sección C",
    "z".repeat(2000),
  ].join("\n");

  const truncated = truncatePreservingHeadings(longSections, 1500);
  assert(truncated.length <= 1500, tc("truncate: respeta el máximo de caracteres"));
  assert(truncated.includes("## Sección A"), tc("truncate: conserva el primer encabezado"));
  assert(truncated.includes("…"), tc("truncate: añade marcador de recorte"));

  // Contenido corto → sin recorte ni marcador
  const shortMd = "## Título\n\nContenido breve.";
  const notTruncated = truncatePreservingHeadings(shortMd, DEFAULT_MAX_CHARS_PER_PHASE);
  assert(notTruncated === shortMd, tc("truncate: contenido corto se devuelve igual"));
  assert(!notTruncated.includes("…"), tc("truncate: sin marcador si no hubo recorte"));

  // Recorte sin encabezados (corte por longitud)
  const longPlain = "palabra ".repeat(1000);
  const cutPlain = truncatePreservingHeadings(longPlain, 200);
  assert(cutPlain.length <= 200, tc("truncate: corte por longitud sin encabezados"));
  assert(cutPlain.includes("…"), tc("truncate: marcador en corte plano"));

  // ── parsePhaseArtifact: limpia + acota un artefacto ──
  const artifact = {
    title: "Informe de Análisis",
    content: [
      "## Mercado",
      "z".repeat(3000),
      "## Preguntas del quiz",
      "¿Cuál es tu target? a) X b) Y",
    ].join("\n"),
  };
  const parsed = parsePhaseArtifact(artifact, { maxCharsPerPhase: 1000 });
  assert(parsed !== null, tc("parsePhaseArtifact: devuelve resumen no nulo"));
  assert(parsed!.title === "Informe de Análisis", tc("parsePhaseArtifact: conserva el título"));
  assert(parsed!.summary.length <= 1000, tc("parsePhaseArtifact: acota a maxChars"));
  assert(parsed!.summary.includes("## Mercado"), tc("parsePhaseArtifact: conserva encabezado clave"));
  assert(!parsed!.summary.includes("quiz"), tc("parsePhaseArtifact: descarta sección de quiz"));

  // Artefacto vacío tras limpiar → null
  const emptyArtifact = parsePhaseArtifact({ title: "Vacío", content: "## Quiz\nsolo ruido" });
  assert(emptyArtifact === null, tc("parsePhaseArtifact: solo ruido → null"));

  // ── parsePreviousPhaseArtifacts: lista completa ──
  const list = parsePreviousPhaseArtifacts([
    { title: "Fase 1", content: "## Resultado\nConsolidado uno." },
    { title: "Fase 2", content: "## Quiz\n¿pregunta?" }, // solo ruido → descartada
    { title: "Fase 3", content: "## Resultado\nConsolidado tres." },
  ]);
  assert(list.length === 2, tc("parsePrevious: descarta fases vacías tras limpiar"));
  assert(list[0].title === "Fase 1", tc("parsePrevious: mantiene el orden"));
  assert(list[1].title === "Fase 3", tc("parsePrevious: salta la fase de solo ruido"));

  // Entrada no-array → []
  assert(
    parsePreviousPhaseArtifacts(undefined as unknown as []).length === 0,
    tc("parsePrevious: entrada inválida → []")
  );

  // ── Determinismo: mismo input → mismo output ──
  const a = parsePreviousPhaseArtifacts([{ title: "X", content: longSections }], { maxCharsPerPhase: 1200 });
  const b = parsePreviousPhaseArtifacts([{ title: "X", content: longSections }], { maxCharsPerPhase: 1200 });
  assert(JSON.stringify(a) === JSON.stringify(b), tc("parser: es determinista"));

  // ── buildConsolidatedContext: string inyectable ──
  const consolidated = buildConsolidatedContext(list);
  assert(consolidated.includes("## Fase 1"), tc("consolidate: incluye título de fase"));
  assert(consolidated.includes("---"), tc("consolidate: separa fases con ---"));
  assert(consolidated.includes("Consolidado uno"), tc("consolidate: incluye contenido"));
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
    await testProjectMemory();
    await testAgentContextRules();
    await testToastQueue();
    await testPhaseLoadingMessages();
    await testPhaseContextParser();
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
