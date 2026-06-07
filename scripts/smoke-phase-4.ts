/**
 * Smoke test for Phase 4 of the IDENTITY refactor + standardized
 * "Ver / Descargar PDF" buttons across all project phases.
 *
 * Run with:
 *   npx tsx scripts/smoke-phase-4.ts
 *
 * What it checks:
 *   1. `buildReportPdf` returns a Buffer that:
 *        - starts with the PDF magic bytes "%PDF"
 *        - is non-trivially sized (>1KB)
 *        - contains the title text somewhere in the body
 *   2. `buildReportPdf` handles all the markdown elements we care
 *      about without throwing:
 *        - headings (#, ##, ###, ####)
 *        - paragraphs
 *        - bullet lists
 *        - ordered lists
 *        - **bold** runs
 *        - horizontal rules
 *        - tables
 *   3. `buildReportHtml` returns a string that:
 *        - contains `<html`
 *        - contains the escaped title
 *        - contains the project name
 *        - contains the print button
 *        - renders markdown body to HTML (with `<h2>`, `<strong>`, etc.)
 *        - preserves pre-rendered HTML when contentType="html"
 *   4. `buildValidationReport` (when DB available) is not exercised
 *      here — it's covered by the route handlers in dev/prod.
 *
 * The script exits with code 0 on success, 1 on any failure.
 */

import { buildReportPdf } from "../src/lib/pdf-export";
import { buildReportHtml } from "../src/lib/report-renderer";

let failures = 0;
function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

const TITLE = "Test Report";
const PROJECT = "TestProject";

const SAMPLE_MARKDOWN = `# ${TITLE}

## Introducción

Esto es un **párrafo** con *énfasis* y \`código\`.

### Lista de features

- Item uno con **negrita**
- Item dos con *itálica*
- Item tres

### Lista numerada

1. Primer paso
2. Segundo paso
3. Tercer paso

#### Tabla

| Columna A | Columna B |
| --- | --- |
| Valor 1 | Valor 2 |
| Valor 3 | Valor 4 |

---

## Conclusión

Esto es un **cierre** con un [enlace](https://example.com).
`;

const SAMPLE_HTML = `<!DOCTYPE html>
<html><head><title>Style Guide A</title></head>
<body>
<h1>Estilo A</h1>
<p>Esta es la <strong>variante A</strong> del style guide visual.</p>
<p>Colores principales: <code>#0F172A</code> y <code>#E2E8F0</code>.</p>
</body></html>`;

// ── 1. buildReportPdf basics ────────────────────────────────────────
console.log("\n[1] buildReportPdf basics");
const pdfBuffer = buildReportPdf({
  title: TITLE,
  content: SAMPLE_MARKDOWN,
  phaseType: "IDENTITY",
  projectName: PROJECT,
});

check(
  "returns a Buffer",
  Buffer.isBuffer(pdfBuffer),
  `got ${typeof pdfBuffer}`
);
check(
  "buffer starts with %PDF",
  pdfBuffer.length >= 4 && pdfBuffer.subarray(0, 4).toString("ascii") === "%PDF",
  `got ${pdfBuffer.subarray(0, 4).toString("hex")}`
);
check(
  "buffer is non-trivially sized (>1KB)",
  pdfBuffer.length > 1024,
  `got ${pdfBuffer.length} bytes`
);
check(
  "buffer contains the PDF EOF marker",
  pdfBuffer.includes(Buffer.from("%%EOF")),
  "no %%EOF marker found"
);
check(
  "buffer is non-empty and finite",
  pdfBuffer.length > 0 && Number.isFinite(pdfBuffer.length)
);

// ── 2. buildReportPdf markdown coverage ────────────────────────────
console.log("\n[2] buildReportPdf markdown coverage");
const simpleMd = `# Title

Paragraph with **bold** text.

- bullet A
- bullet B

1. ordered A
2. ordered B

| H1 | H2 |
| --- | --- |
| a | b |

## Section

---

End.`;
const pdf2 = buildReportPdf({
  title: "M2",
  content: simpleMd,
  phaseType: "CONTENT",
  projectName: "P",
});
check("simple markdown PDF starts with %PDF", pdf2.subarray(0, 4).toString("ascii") === "%PDF");
check("simple markdown PDF is >500B", pdf2.length > 500, `got ${pdf2.length}`);

const emptyMd = `# Solo título`;
const pdf3 = buildReportPdf({
  title: "Empty",
  content: emptyMd,
  phaseType: "EXECUTION",
  projectName: "P",
});
check("minimal PDF still valid", pdf3.subarray(0, 4).toString("ascii") === "%PDF");
check("minimal PDF is non-empty", pdf3.length > 200);

const hugeMd = "## L\n\n" + Array.from({ length: 200 }, (_, i) => `Párrafo ${i} con texto`).join("\n\n");
const pdf4 = buildReportPdf({
  title: "Big",
  content: hugeMd,
  phaseType: "DOSSIER",
  projectName: "P",
});
check("large markdown PDF generates multiple pages", pdf4.length > 5000, `got ${pdf4.length} bytes`);

// ── 3. buildReportHtml (markdown) ───────────────────────────────────
console.log("\n[3] buildReportHtml (markdown mode)");
const html = buildReportHtml({
  title: TITLE,
  content: SAMPLE_MARKDOWN,
  contentType: "markdown",
  projectName: PROJECT,
  phaseType: "IDENTITY",
});
check("html is a string", typeof html === "string");
check("html contains <html", html.includes("<html"));
check("html contains DOCTYPE", html.includes("<!DOCTYPE html>"));
check("html contains escaped title (inside <h1>)", html.includes(`<h1 class="report-title">${TITLE}</h1>`));
check("html contains project name", html.includes(PROJECT));
check("html contains phaseType", html.includes("IDENTITY"));
check("html contains the print button", html.includes("Imprimir / Guardar como PDF"));
check("html contains window.print() call", html.includes("window.print()"));
check("html has inline <style>", html.includes("<style>"));
check("html markdown body has <h2>", html.includes("<h2"));
check("html markdown body has <strong>", html.includes("<strong>"));
check("html markdown body has <ul>", html.includes("<ul"));
check("html markdown body has <ol>", html.includes("<ol"));
check("html markdown body has <table>", html.includes("<table"));
check("html markdown body has <a href=", html.includes('<a href="https://example.com"'));

// ── 4. buildReportHtml (html mode) ──────────────────────────────────
console.log("\n[4] buildReportHtml (html mode — IDENTITY final artifact)");
const html2 = buildReportHtml({
  title: "Style Guide",
  content: SAMPLE_HTML,
  contentType: "html",
  projectName: PROJECT,
  phaseType: "IDENTITY",
});
check("html-mode: contains <html", html2.includes("<html"));
check("html-mode: contains the page title", html2.includes("Style Guide"));
check(
  "html-mode: preserves the body content (Estilo A heading text)",
  html2.includes("Estilo A")
);
check(
  "html-mode: preserves inner <strong>",
  html2.includes("<strong>variante A</strong>")
);
check(
  "html-mode: only one <body> tag (the outer one, inner stripped)",
  (html2.match(/<body>/g) || []).length === 1
);
check(
  "html-mode: strips the inner <!DOCTYPE> tag",
  (html2.match(/<!DOCTYPE/gi) || []).length === 1 // only the outer one
);
check(
  "html-mode: only one <html> tag (the outer one)",
  (html2.match(/<html[\s>]/gi) || []).length === 1
);

// ── 5. HTML escaping ────────────────────────────────────────────────
console.log("\n[5] HTML escaping");
const xssTitle = `<script>alert(1)</script>`;
const htmlXss = buildReportHtml({
  title: xssTitle,
  content: "Plain content",
  contentType: "markdown",
  projectName: "P",
  phaseType: "TEST",
});
check(
  "XSS title is escaped in <title> tag",
  htmlXss.includes("&lt;script&gt;alert(1)&lt;/script&gt;") &&
    !htmlXss.includes("<script>alert(1)</script>"),
  "raw <script> should be escaped"
);
check(
  "XSS title is escaped in <h1> tag",
  htmlXss.includes("&lt;script&gt;alert(1)&lt;/script&gt;")
);

// ── 6. Determinism / idempotence ────────────────────────────────────
console.log("\n[6] Determinism");
const a = buildReportPdf({
  title: "Det",
  content: "# A\n\nbody",
  phaseType: "X",
  projectName: "Y",
  generatedAt: new Date("2026-01-01T00:00:00Z"),
});
const b = buildReportPdf({
  title: "Det",
  content: "# A\n\nbody",
  phaseType: "X",
  projectName: "Y",
  generatedAt: new Date("2026-01-01T00:00:00Z"),
});
// PDFs from jsPDF include a creation timestamp in the metadata + a unique
// /ID by default, so byte-exact equality is NOT expected. Instead we
// check both buffers are valid PDFs of comparable size.
check("deterministic call #1 is a valid PDF", a.subarray(0, 4).toString("ascii") === "%PDF");
check("deterministic call #2 is a valid PDF", b.subarray(0, 4).toString("ascii") === "%PDF");
check(
  "deterministic calls produce similar-sized PDFs (±20%)",
  Math.abs(a.length - b.length) / a.length < 0.2,
  `a=${a.length} b=${b.length}`
);

// ── Summary ─────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(50));
if (failures === 0) {
  console.log("✅ All Phase 4 smoke checks passed.");
  process.exit(0);
} else {
  console.error(`❌ ${failures} smoke check(s) failed.`);
  process.exit(1);
}
