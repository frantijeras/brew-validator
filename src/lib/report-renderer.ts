/**
 * report-renderer.ts
 *
 * Phase 4 of the IDENTITY refactor + standardization of "Ver / Descargar"
 * across ALL project phases.
 *
 * Exports `buildReportHtml`, which converts a phase artifact's content
 * (markdown or pre-rendered HTML) into a self-contained HTML document
 * suitable for:
 *
 *   1. Streaming from GET /api/projects/[id]/phases/[phaseId]/view (HTML view)
 *   2. Streaming from GET /api/projects/[id]/validation/view (phase 0 / idea)
 *   3. Embedding in an <iframe srcDoc> from the client (in the future)
 *
 * The HTML is intentionally self-contained (inline styles, no external
 * assets) so it works in:
 *   - The browser "open in new tab" flow.
 *   - A sandboxed iframe.
 *   - When the user does "Save as…" / `window.print()` → "Save as PDF".
 *
 * It also embeds a "Imprimir / Guardar como PDF" button at the top
 * that calls `window.print()`. The same `print()` flow lets the user
 * produce a PDF without us having to maintain a separate PDF pipeline
 * for the in-app view.
 */

import { renderMarkdown } from "@/components/markdown-renderer";

/* ── Types ──────────────────────────────────────────────────────────── */

export interface BuildReportHtmlParams {
  /** Title of the report (e.g. "Brand Book", "Análisis de Mercado"). */
  title: string;
  /**
   * Body of the report. Either markdown source (will be rendered to HTML
   * via `renderMarkdown`) or pre-rendered HTML (used as-is, in a
   * sandboxed wrapper). HTML mode is used for the IDENTITY sub-step
   * `final` artifact, which is a full style-guide document.
   */
  content: string;
  /** Whether the body is markdown source or pre-rendered HTML. */
  contentType: "markdown" | "html";
  /** Project name shown in the page header. */
  projectName: string;
  /** Phase type key (e.g. "IDENTITY", "VALIDATION"). */
  phaseType: string;
  /** Optional generation timestamp. Defaults to `new Date()`. */
  generatedAt?: Date;
}

/* ── Inline stylesheet (no external assets) ────────────────────────── */

const INLINE_CSS = `
  :root {
    color-scheme: light dark;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
    color: #1f2937;
    background: #ffffff;
    padding: 0;
  }
  .report-container {
    max-width: 820px;
    margin: 0 auto;
    padding: 32px 24px 64px;
  }
  .report-header {
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 20px;
    margin-bottom: 28px;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .report-header-text { flex: 1 1 auto; min-width: 0; }
  .report-project {
    font-size: 13px;
    color: #6b7280;
    margin: 0 0 4px 0;
    font-weight: 500;
    letter-spacing: 0.01em;
  }
  .report-title {
    font-size: 26px;
    font-weight: 700;
    color: #111827;
    margin: 0;
    line-height: 1.25;
  }
  .report-meta {
    margin-top: 6px;
    font-size: 12px;
    color: #9ca3af;
  }
  .report-actions {
    flex: 0 0 auto;
  }
  .print-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: #111827;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    font-family: inherit;
  }
  .print-btn:hover { background: #1f2937; }
  .print-btn svg { width: 14px; height: 14px; }
  .report-body { font-size: 15px; }
  .report-body h1 { font-size: 28px; font-weight: 700; margin: 28px 0 14px; color: #111827; line-height: 1.25; }
  .report-body h2 { font-size: 22px; font-weight: 700; margin: 26px 0 12px; color: #111827; line-height: 1.3; }
  .report-body h3 { font-size: 18px; font-weight: 600; margin: 22px 0 10px; color: #1f2937; }
  .report-body h4 { font-size: 16px; font-weight: 600; margin: 18px 0 8px; color: #1f2937; }
  .report-body p { margin: 0 0 14px; color: #374151; }
  .report-body ul, .report-body ol { margin: 0 0 14px; padding-left: 26px; }
  .report-body li { margin: 0 0 6px; color: #374151; }
  .report-body strong { color: #111827; font-weight: 600; }
  .report-body em { color: #4b5563; }
  .report-body code {
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    color: #b45309;
  }
  .report-body pre {
    background: #1f2937;
    color: #f3f4f6;
    padding: 14px 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 0 0 16px;
    font-size: 13px;
  }
  .report-body pre code {
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }
  .report-body blockquote {
    border-left: 3px solid #f59e0b;
    padding: 4px 14px;
    margin: 0 0 16px;
    color: #6b7280;
    font-style: italic;
  }
  .report-body hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 24px 0;
  }
  .report-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 16px;
    font-size: 14px;
  }
  .report-body th, .report-body td {
    border: 1px solid #e5e7eb;
    padding: 8px 12px;
    text-align: left;
  }
  .report-body th {
    background: #f9fafb;
    font-weight: 600;
    color: #111827;
  }
  .report-body a { color: #b45309; text-decoration: underline; }
  .report-body a:hover { color: #92400e; }
  .report-footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    font-size: 12px;
    color: #9ca3af;
    text-align: center;
  }

  /* When the user hits "Imprimir" the print button and footer chrome
     are hidden so the PDF looks clean. We keep the header line and the
     body styles intact for a good print layout. */
  @media print {
    body { background: #ffffff; }
    .print-btn { display: none !important; }
    .report-container { max-width: 100%; padding: 0 0 0 0; }
    .report-header { border-bottom: 1px solid #d1d5db; }
    .report-footer { display: none; }
    .report-body a { color: #111827; text-decoration: none; }
  }
`;

/** Small inline icon for the print button (printer glyph). */
const PRINT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`;

/**
 * Escape a string for safe inclusion in HTML. Used to escape the page
 * title and project name in case they contain `<`, `>`, `&`, `"`, or `'`.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build a self-contained HTML document from a phase artifact.
 *
 * - Markdown: rendered via `renderMarkdown` (same parser the web UI uses).
 * - HTML: embedded inside the wrapper. We do NOT sandbox it (it's trusted
 *   content from our own database; in production we'd want to consider
 *   iframe sandbox attributes for untrusted content, but here the source
 *   is the LLM-generated style guide, which is rendered inside our own
 *   route handler).
 */
export function buildReportHtml(params: BuildReportHtmlParams): string {
  const { title, content, contentType, projectName, phaseType } = params;
  const generatedAt = params.generatedAt ?? new Date();
  const dateStr = generatedAt.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let bodyHtml: string;
  if (contentType === "html") {
    // Already HTML. Drop any DOCTYPE/<html>/<head>/<body> tags so the body
    // embeds cleanly inside our document. We keep the inner HTML as-is.
    bodyHtml = content
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<\/?(html|head|body)[^>]*>/gi, "");
  } else {
    bodyHtml = renderMarkdown(content);
  }

  const titleEsc = escapeHtml(title);
  const projectEsc = escapeHtml(projectName);
  const phaseEsc = escapeHtml(phaseType);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="generator" content="BrewIdea Validator" />
  <title>${titleEsc} — ${projectEsc}</title>
  <style>${INLINE_CSS}</style>
</head>
<body>
  <div class="report-container">
    <header class="report-header">
      <div class="report-header-text">
        <p class="report-project">${projectEsc}</p>
        <h1 class="report-title">${titleEsc}</h1>
        <p class="report-meta">Fase: ${phaseEsc} · Generado: ${dateStr}</p>
      </div>
      <div class="report-actions">
        <button class="print-btn" onclick="window.print()" type="button">
          ${PRINT_ICON_SVG}
          <span>Imprimir / Guardar como PDF</span>
        </button>
      </div>
    </header>

    <main class="report-body">
      ${bodyHtml}
    </main>

    <footer class="report-footer">
      Generado con BrewIdea Validator · ${projectEsc} — ${titleEsc}
    </footer>
  </div>
</body>
</html>`;
}
