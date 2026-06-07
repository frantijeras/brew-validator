import { jsPDF } from "jspdf";

/* ── Judge content cleanup ──────────────────────────────────────────── */
// Matches the same cleanup the web UI does (markdown-renderer.tsx) so the
// PDF rendering of judge reports is consistent with what the user sees in
// the browser. Without this, the PDF shows duplicate scorecard tables and
// decorative emojis that the web UI strips out.

const JUDGE_EMOJI_REGEX_PDF = /[📊⭐✅🎯🏆💪🔍❌📈📋✨🔥💡⚖️🛡️🚀💰]/g;

function cleanJudgeReportPdf(content: string): string {
  let clean = content;

  // Strip replacement characters
  clean = clean.replace(/\uFFFD/g, "");

  // Remove decorative emojis
  clean = clean.replace(JUDGE_EMOJI_REGEX_PDF, "");

  // Remove duplicate "## Scorecard" sections (keep only the first)
  const scorecardMatches = [...clean.matchAll(/^## Scorecard[\s\S]*?(?=^## |\n---|\n\n\n|$)/gim)];
  if (scorecardMatches.length > 1) {
    for (let i = 1; i < scorecardMatches.length; i++) {
      clean = clean.replace(scorecardMatches[i][0], "");
    }
  }

  // Remove "## Decisión" section
  clean = clean.replace(/^## Decisión[\s\S]*?(?=^## |$)/gm, "");

  // Remove "## Veredicto" header line (keep the content)
  // without this, the LLM's "## Veredicto" header + "**Verdicto: ...**" body
  // creates a visible "Veredicto Veredicto" duplication
  clean = clean.replace(/^## Veredicto\s*\n+/gm, "");

  // Remove any "## Puntuación*" / "## Scorecard*" / "## Tabla de Puntuaciones"
  // section — the scorecard is rendered separately from the JSON
  const sectionHeaderRe = /^##\s+[^\n]*(puntuación|puntuacion|scorecard|tabla\s+de\s+puntuaciones?|tabla\s+de\s+scores)[^\n]*$/gim;
  clean = clean.replace(sectionHeaderRe, "");

  // Remove loose scorecard tables (header has "Dimensión" + "Puntuación")
  const looseTableRe = /^\|[^\n]*\|[^\n]*\|\s*\n\|[\s:|-]+\|[\s:|-]+\|\s*\n(?:\|[^\n]*\|\s*\n?)+/gm;
  clean = clean.replace(looseTableRe, (match) => {
    const firstLine = match.split("\n")[0].toLowerCase();
    if (/dimensi[oó]n/.test(firstLine) && /(puntuaci[oó]n|puntuacion|score)/.test(firstLine)) return "";
    return match;
  });

  // Collapse multiple blank lines
  clean = clean.replace(/\n{3,}/g, "\n\n");

  return clean.trim();
}

/* ── Type matching the export API response ── */

interface ExportData {
  title: string;
  description: string;
  problem: string;
  valueProposition: string;
  targetUser: string;
  monetization: string;
  businessModel: string;
  score: number | null;
  verdict: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  reports: ExportReport[];
  versions: ExportVersion[];
}

interface ExportReport {
  title: string;
  agentName: string;
  verdict: string | null;
  scorecard: string | null;
  content: string;
  createdAt: string;
}

interface ExportVersion {
  title: string;
  phase: string;
  createdAt: string;
}

/* ── Constants ── */

const MARGIN = 20;
const PAGE_W = 210; // A4 mm
const CONTENT_W = PAGE_W - MARGIN * 2;

// Colors
const C_BLACK = [0, 0, 0] as [number, number, number];
const C_DARK = [50, 50, 50] as [number, number, number];
const C_GREY = [100, 100, 100] as [number, number, number];
const C_LIGHT = [150, 150, 150] as [number, number, number];
const C_ACCENT = [180, 130, 20] as [number, number, number]; // amber-ish
const C_BG = [245, 245, 245] as [number, number, number]; // light grey bg

/* ── Helpers ── */

const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}📊⭐✅🎯🏆💪🔍❌📈📋✨🔥💡]/gu;

function stripEmojis(text: string): string {
  return text.replace(EMOJI_REGEX, "").replace(/\s+/g, " ").trim();
}

function agentLabel(name: string): string {
  switch (name) {
    case "skeptic": return "Escéptico";
    case "advocate": return "Defensor";
    case "judge": return "Juez";
    case "idea-generator": return "Generador de ideas";
    default: return name;
  }
}

/**
 * Parse markdown into structured blocks for PDF rendering.
 */
type MdBlock =
  | { type: "h1" | "h2" | "h3" | "h4"; text: string }
  | { type: "p"; text: string }
  | { type: "bold-line"; label: string; rest: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" };

function parseMarkdownBlocks(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const headingType = `h${level}` as "h1" | "h2" | "h3" | "h4";
      blocks.push({ type: headingType, text: stripEmojis(hMatch[2].replace(/\*{1,3}(.+?)\*{1,3}/g, "$1")) });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Table (starts with |). Separator line is | --- | --- | (with or
    // without spaces). Match the canonical markdown table separator.
    if (trimmed.startsWith("|") && i + 1 < lines.length) {
      const sep = lines[i + 1]?.trim() ?? "";
      const isTableSep = /^\|[\s:|-]+\|$/.test(sep);
      if (isTableSep) {
        const headers = trimmed.split("|").map(s => s.trim()).filter(Boolean);
        i += 2; // skip header + separator
        const rows: string[][] = [];
        while (i < lines.length && lines[i]?.trim().startsWith("|")) {
          rows.push(lines[i].trim().split("|").map(s => s.trim()).filter(Boolean));
          i++;
        }
        blocks.push({ type: "table", headers, rows });
        continue;
      }
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[\t ]*[-*+]\s+/.test(lines[i]?.trim())) {
        items.push(stripEmojis(lines[i].trim().replace(/^[-*+]\s+/, "").replace(/\*{1,3}(.+?)\*{1,3}/g, "$1")));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[\t ]*\d+\.\s+/.test(lines[i]?.trim())) {
        items.push(stripEmojis(lines[i].trim().replace(/^\d+\.\s+/, "").replace(/\*{1,3}(.+?)\*{1,3}/g, "$1")));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Bold-prefixed line: "**Label:** rest of text"
    const boldMatch = trimmed.match(/^\*{2}([^*]+)\*{2}\s*[:：]?\s*(.*)/);
    if (boldMatch && boldMatch[2]) {
      blocks.push({ type: "bold-line", label: stripEmojis(boldMatch[1]), rest: stripEmojis(boldMatch[2].replace(/\*{1,3}(.+?)\*{1,3}/g, "$1")) });
      i++;
      continue;
    }

    // Regular paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pl = lines[i]?.trim();
      if (!pl) break;
      if (pl.startsWith("#") || pl.startsWith("|") || /^[-*+]\s+/.test(pl) || /^\d+\.\s+/.test(pl) || /^(-{3,}|\*{3,})$/.test(pl)) break;
      paraLines.push(stripEmojis(pl.replace(/\*{1,3}(.+?)\*{1,3}/g, "$1")));
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "p", text: paraLines.join(" ") });
    }

    // Defensive: if none of the branches above advanced `i` for this
    // line (e.g. an unrecognized syntax like a stray `| ` row from a
    // malformed table), force-advance to avoid an infinite loop. The
    // line is rendered as a plain paragraph so it doesn't get lost.
    if (paraLines.length === 0) {
      blocks.push({ type: "p", text: stripEmojis(trimmed) });
      i++;
    }
  }

  return blocks;
}

/* ── PDF renderer ── */

export function generatePdf(filename: string, data: ExportData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;
  const pageH = doc.internal.pageSize.getHeight();

  function checkSpace(needed: number): void {
    if (y + needed > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function drawHr(): void {
    checkSpace(4);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  }

  function writeText(text: string, size: number, color: [number, number, number], style: "normal" | "bold" = "normal", indent = 0): void {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    for (const line of lines) {
      checkSpace(size * 0.5);
      doc.text(line, MARGIN + indent, y);
      y += size * 0.5;
    }
  }

  function writeMdBlocks(blocks: MdBlock[]): void {
    for (const block of blocks) {
      switch (block.type) {
        case "h1":
          checkSpace(10);
          y += 3;
          writeText(block.text, 16, C_BLACK, "bold");
          y += 3;
          break;
        case "h2":
          checkSpace(8);
          y += 2;
          writeText(block.text, 13, C_BLACK, "bold");
          y += 2;
          break;
        case "h3":
          checkSpace(7);
          y += 1;
          writeText(block.text, 11, C_DARK, "bold");
          y += 1;
          break;
        case "h4":
          checkSpace(6);
          writeText(block.text, 10, C_DARK, "bold");
          y += 1;
          break;
        case "p":
          writeText(block.text, 9, C_DARK);
          y += 2;
          break;
        case "bold-line":
          checkSpace(5);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...C_DARK);
          doc.text(`${block.label}:`, MARGIN, y);
          const labelW = doc.getTextWidth(`${block.label}: `);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...C_DARK);
          const restLines = doc.splitTextToSize(block.rest, CONTENT_W - labelW - 2);
          doc.text(restLines[0] || "", MARGIN + labelW, y);
          y += 5;
          // Continuation lines
          for (let r = 1; r < restLines.length; r++) {
            checkSpace(5);
            doc.text(restLines[r], MARGIN, y);
            y += 5;
          }
          break;
        case "ul":
          for (const item of block.items) {
            checkSpace(5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...C_DARK);
            doc.text("•", MARGIN + 2, y);
            const itemLines = doc.splitTextToSize(item, CONTENT_W - 8);
            doc.text(itemLines[0], MARGIN + 7, y);
            y += 5;
            for (let r = 1; r < itemLines.length; r++) {
              checkSpace(5);
              doc.text(itemLines[r], MARGIN + 7, y);
              y += 5;
            }
          }
          y += 2;
          break;
        case "ol":
          block.items.forEach((item, idx) => {
            checkSpace(5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...C_DARK);
            doc.text(`${idx + 1}.`, MARGIN + 1, y);
            const itemLines = doc.splitTextToSize(item, CONTENT_W - 10);
            doc.text(itemLines[0], MARGIN + 8, y);
            y += 5;
            for (let r = 1; r < itemLines.length; r++) {
              checkSpace(5);
              doc.text(itemLines[r], MARGIN + 8, y);
              y += 5;
            }
          });
          y += 2;
          break;
        case "table": {
          // Table with proportional column widths and text wrapping
          if (block.headers.length === 0) break;
          const colCount = block.headers.length;
          const tableWidth = CONTENT_W - 20;

          // Calculate proportional column widths based on content length
          let totalChars = 0;
          const maxLens: number[] = [];
          for (let ci = 0; ci < colCount; ci++) {
            let maxLen = stripEmojis(block.headers[ci] || "").length;
            for (const row of block.rows) {
              const cellLen = stripEmojis(row[ci] || "").length;
              if (cellLen > maxLen) maxLen = cellLen;
            }
            maxLens.push(maxLen);
            totalChars += maxLen;
          }

          const colWidths: number[] = maxLens.map(
            (len) => Math.max(20, (len / Math.max(totalChars, 1)) * tableWidth)
          );
          // Normalize to fit exact tableWidth
          const sum = colWidths.reduce((a, b) => a + b, 0);
          for (let ci = 0; ci < colCount; ci++) colWidths[ci] = (colWidths[ci] / sum) * tableWidth;

          let x = MARGIN;

          // Header row with background
          checkSpace(6);
          doc.setFillColor(...C_BG);
          doc.rect(MARGIN, y - 4, tableWidth, 6, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...C_DARK);
          for (let ci = 0; ci < colCount; ci++) {
            const cellLines = doc.splitTextToSize(
              stripEmojis(block.headers[ci] || ""),
              colWidths[ci] - 2
            );
            doc.text(cellLines, x + 1, y);
            x += colWidths[ci];
          }

          // Header bottom line
          y += 6;
          doc.setDrawColor(180, 180, 180);
          doc.line(MARGIN, y, MARGIN + tableWidth, y);
          doc.setFont("helvetica", "normal");

          // Data rows
          for (const row of block.rows) {
            // Pre-calculate max row height
            let maxRowHeight = 0;
            const cellLinesPerCol: string[][] = [];
            for (let ci = 0; ci < colCount; ci++) {
              const cell = stripEmojis(row[ci] || "");
              const lines = doc.splitTextToSize(cell, colWidths[ci] - 2);
              cellLinesPerCol.push(lines);
              if (lines.length > maxRowHeight) maxRowHeight = lines.length;
            }

            const rowHeight = maxRowHeight * 4 + 2;
            if (y + rowHeight > pageH - MARGIN) {
              doc.addPage();
              y = MARGIN;
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
            }

            x = MARGIN;
            for (let ci = 0; ci < colCount; ci++) {
              doc.text(cellLinesPerCol[ci], x + 1, y + 1);
              x += colWidths[ci];
            }

            // Row separator
            y += rowHeight;
            doc.setDrawColor(230, 230, 230);
            doc.line(MARGIN, y, MARGIN + tableWidth, y);
          }

          y += 4;
          break;
        }
        case "hr":
          drawHr();
          break;
      }
    }
  }

  // ── Title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...C_BLACK);
  const cleanTitle = stripEmojis(data.title);
  const titleLines = doc.splitTextToSize(cleanTitle, CONTENT_W);
  checkSpace(6 + titleLines.length * 8);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 8 + 4;

  // ── Info grid ──
  doc.setFontSize(9);
  doc.setTextColor(...C_GREY);
  const infoLines = [
    `Modelo de negocio: ${stripEmojis(data.businessModel)}`,
    `Score: ${data.score !== null ? `${data.score.toFixed(1)}/10` : "—"}  |  Veredicto: ${data.verdict ? stripEmojis(data.verdict) : "—"}`,
    `Creada: ${data.createdAt}`,
  ];
  for (const line of infoLines) {
    checkSpace(5);
    doc.text(line, MARGIN, y);
    y += 5;
  }
  y += 3;

  drawHr();

  // ── Section: Descripción ──
  checkSpace(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C_BLACK);
  doc.text("Descripción", MARGIN, y);
  y += 7;

  writeText(stripEmojis(data.description), 10, C_DARK);
  y += 4;

  // ── Section: Detalles ──
  const detailSections = [
    { label: "Problema", value: data.problem },
    { label: "Propuesta de valor", value: data.valueProposition },
    { label: "Usuario objetivo", value: data.targetUser },
    { label: "Monetización", value: data.monetization },
  ];

  for (const section of detailSections) {
    checkSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...C_BLACK);
    doc.text(section.label, MARGIN, y);
    y += 5;

    writeText(stripEmojis(section.value), 9, C_DARK);
    y += 3;
  }

  drawHr();

  // ── Section: Reportes ──
  checkSpace(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...C_BLACK);
  doc.text("Reportes de validación", MARGIN, y);
  y += 8;

  for (const report of data.reports) {
    const label = agentLabel(report.agentName);

    checkSpace(20);

    // Report header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C_BLACK);
    const reportHeader = `${label} — ${stripEmojis(report.title)}`;
    const reportHeaderLines = doc.splitTextToSize(reportHeader, CONTENT_W);
    for (const hl of reportHeaderLines) {
      checkSpace(5);
      doc.text(hl, MARGIN, y);
      y += 5;
    }

    // Meta line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C_LIGHT);
    const meta = `${report.createdAt}${report.verdict ? `  ·  Veredicto: ${stripEmojis(report.verdict)}` : ""}`;
    doc.text(meta, MARGIN, y);
    y += 5;

    // Scorecard (if available)
    if (report.scorecard) {
      try {
        const parsed = JSON.parse(report.scorecard);
        // Normalize to [key, value, description?] entries.
        // Supports:
        //   - flat object: {"Problema": 6.0, ..., "Total": 4.5}  (legacy)
        //   - array k/v/d: [{k: "Problema", v: 6.0, d: "..."}, ...]  (judge v4, new)
        //   - array key/value/description: [{key, value, description}, ...]  (legacy)
        type ScEntry = [string, number | string, string | undefined];
        const entries: ScEntry[] = [];
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
            const obj = item as Record<string, unknown>;
            if (obj.k !== undefined) {
              // New k/v/d format
              entries.push([
                String(obj.k),
                typeof obj.v === "number" || typeof obj.v === "string" ? obj.v : 0,
                typeof obj.d === "string" ? obj.d : undefined,
              ]);
            } else if (obj.key !== undefined) {
              // Legacy key/value/description
              entries.push([
                String(obj.key),
                typeof obj.value === "number" || typeof obj.value === "string" ? obj.value : 0,
                typeof obj.description === "string" ? obj.description : undefined,
              ]);
            }
          }
        } else if (typeof parsed === "object" && parsed !== null) {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            entries.push([k, typeof v === "number" || typeof v === "string" ? v : 0, undefined]);
          }
        }
        if (entries.length > 0) {
          checkSpace(8);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...C_ACCENT);
          doc.text("Puntuación:", MARGIN, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...C_DARK);
          for (const [key, val, desc] of entries) {
            const scoreStr = typeof val === "number" ? val.toFixed(1) : String(val);
            const lineText = desc
              ? `${key}: ${scoreStr}/10 — ${desc}`
              : `${key}: ${scoreStr}/10`;
            // Wrap long lines so dimension names + descriptions never get clipped
            // (e.g. "Monetización: 4.5/10 — Freemium viable...").
            const lines = doc.splitTextToSize(lineText, CONTENT_W - 3);
            for (const line of lines) {
              checkSpace(4);
              doc.text(line, MARGIN + 3, y);
              y += 4;
            }
          }
          y += 2;
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    // Report content (parsed markdown)
    // Apply same cleanup as the web UI for judge reports so the output is consistent
    const reportContent = report.agentName === "judge" ? cleanJudgeReportPdf(report.content) : report.content;
    const blocks = parseMarkdownBlocks(reportContent);
    writeMdBlocks(blocks);

    // Separator
    checkSpace(3);
    doc.setDrawColor(220, 220, 220);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;
  }

  // ── Footer ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C_LIGHT);
    doc.text(
      `BrewIdea Validator · Informe generado el ${new Date().toLocaleDateString("es-ES")}`,
      MARGIN,
      pageH - 8
    );
    doc.text(`Pág. ${i} / ${totalPages}`, PAGE_W - MARGIN, pageH - 8, { align: "right" });
  }

  doc.save(filename);
}

/* ─────────────────────────────────────────────────────────────────────
 * PHASE 4 — Project phase report export
 *
 * `buildReportPdf` is the generic markdown → PDF converter used by:
 *   - GET /api/projects/[id]/phases/[phaseId]/download  (project phases)
 *   - GET /api/projects/[id]/validation/download        (phase 0 / idea)
 *
 * Unlike `generatePdf` (above) which is purpose-built for the ideas
 * validation reports, `buildReportPdf` takes raw markdown + metadata
 * and produces a clean, paginated PDF buffer.
 *
 * Key differences from `generatePdf`:
 *   - Returns a Buffer (not saved to disk) so it can be streamed by
 *     Next.js route handlers.
 *   - Header shows `projectName — title` + generation date.
 *   - Page numbers in the footer.
 *   - Markdown rendering uses the shared `parseMarkdownBlocks` helper.
 *
 * Supports: headings (h1-h4), paragraphs, bullet lists, ordered lists,
 * tables, bold lines (`**Label:** rest`), and horizontal rules.
 * ───────────────────────────────────────────────────────────────────── */

/** Parameters for `buildReportPdf`. */
export interface BuildReportPdfParams {
  /** Title of the report (e.g. "Brand Book", "Análisis de Mercado"). */
  title: string;
  /** Markdown body. May be a single document or multiple sections. */
  content: string;
  /** Phase type key (e.g. "IDENTITY", "VALIDATION"). Used in the header. */
  phaseType: string;
  /** Project name shown in the header. */
  projectName: string;
  /** Generation timestamp. Defaults to `new Date()`. */
  generatedAt?: Date;
}

export function buildReportPdf(params: BuildReportPdfParams): Buffer {
  const { title, content, phaseType, projectName } = params;
  const generatedAt = params.generatedAt ?? new Date();

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  // CONTENT_W = pageW - MARGIN*2 (use a local recompute to be safe across formats)
  const localContentW = pageW - MARGIN * 2;

  function checkSpace(needed: number): void {
    if (y + needed > pageH - MARGIN) {
      addPage();
    }
  }

  function addPage(): void {
    doc.addPage();
    y = MARGIN;
  }

  function drawHr(): void {
    checkSpace(4);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  }

  /**
   * Render a single text line at the current y, advancing y based on
   * the number of wrapped lines. If a bold prefix is provided, the
   * first chunk is rendered in bold and the rest in normal weight.
   */
  function writeText(
    text: string,
    size: number,
    color: [number, number, number],
    style: "normal" | "bold" = "normal",
    indent = 0
  ): void {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, localContentW - indent);
    for (const line of lines) {
      checkSpace(size * 0.6);
      doc.text(line, MARGIN + indent, y);
      y += size * 0.5;
    }
  }

  function writeMdBlocks(blocks: MdBlock[]): void {
    for (const block of blocks) {
      switch (block.type) {
        case "h1":
          checkSpace(10);
          y += 3;
          writeText(stripEmojis(block.text), 16, C_BLACK, "bold");
          y += 3;
          break;
        case "h2":
          checkSpace(8);
          y += 2;
          writeText(stripEmojis(block.text), 13, C_BLACK, "bold");
          y += 2;
          break;
        case "h3":
          checkSpace(7);
          y += 1;
          writeText(stripEmojis(block.text), 11, C_DARK, "bold");
          y += 1;
          break;
        case "h4":
          checkSpace(6);
          writeText(stripEmojis(block.text), 10, C_DARK, "bold");
          y += 1;
          break;
        case "p":
          writeText(stripEmojis(block.text), 9, C_DARK);
          y += 2;
          break;
        case "bold-line":
          checkSpace(5);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...C_DARK);
          doc.text(`${stripEmojis(block.label)}:`, MARGIN, y);
          const labelW = doc.getTextWidth(`${stripEmojis(block.label)}: `);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...C_DARK);
          const restLines = doc.splitTextToSize(stripEmojis(block.rest), localContentW - labelW - 2);
          doc.text(restLines[0] || "", MARGIN + labelW, y);
          y += 5;
          for (let r = 1; r < restLines.length; r++) {
            checkSpace(5);
            doc.text(restLines[r], MARGIN, y);
            y += 5;
          }
          break;
        case "ul":
          for (const item of block.items) {
            checkSpace(5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...C_DARK);
            doc.text("•", MARGIN + 2, y);
            const itemLines = doc.splitTextToSize(stripEmojis(item), localContentW - 8);
            doc.text(itemLines[0], MARGIN + 7, y);
            y += 5;
            for (let r = 1; r < itemLines.length; r++) {
              checkSpace(5);
              doc.text(itemLines[r], MARGIN + 7, y);
              y += 5;
            }
          }
          y += 2;
          break;
        case "ol":
          block.items.forEach((item, idx) => {
            checkSpace(5);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...C_DARK);
            doc.text(`${idx + 1}.`, MARGIN + 1, y);
            const itemLines = doc.splitTextToSize(stripEmojis(item), localContentW - 10);
            doc.text(itemLines[0], MARGIN + 8, y);
            y += 5;
            for (let r = 1; r < itemLines.length; r++) {
              checkSpace(5);
              doc.text(itemLines[r], MARGIN + 8, y);
              y += 5;
            }
          });
          y += 2;
          break;
        case "table": {
          // Table with proportional column widths and text wrapping
          if (block.headers.length === 0) break;
          const colCount = block.headers.length;
          const tableWidth = localContentW - 20;

          // Calculate proportional column widths based on content length
          let totalChars = 0;
          const maxLens: number[] = [];
          for (let ci = 0; ci < colCount; ci++) {
            let maxLen = stripEmojis(block.headers[ci] || "").length;
            for (const row of block.rows) {
              const cellLen = stripEmojis(row[ci] || "").length;
              if (cellLen > maxLen) maxLen = cellLen;
            }
            maxLens.push(maxLen);
            totalChars += maxLen;
          }

          const colWidths: number[] = maxLens.map(
            (len) => Math.max(20, (len / Math.max(totalChars, 1)) * tableWidth)
          );
          // Normalize to fit exact tableWidth
          const sum = colWidths.reduce((a, b) => a + b, 0);
          for (let ci = 0; ci < colCount; ci++) colWidths[ci] = (colWidths[ci] / sum) * tableWidth;

          let x = MARGIN;

          // Header row with background
          checkSpace(6);
          doc.setFillColor(...C_BG);
          doc.rect(MARGIN, y - 4, tableWidth, 6, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(...C_DARK);
          for (let ci = 0; ci < colCount; ci++) {
            const cellLines = doc.splitTextToSize(
              stripEmojis(block.headers[ci] || ""),
              colWidths[ci] - 2
            );
            doc.text(cellLines, x + 1, y);
            x += colWidths[ci];
          }

          // Header bottom line
          y += 6;
          doc.setDrawColor(180, 180, 180);
          doc.line(MARGIN, y, MARGIN + tableWidth, y);
          doc.setFont("helvetica", "normal");

          // Data rows
          for (const row of block.rows) {
            // Pre-calculate max row height
            let maxRowHeight = 0;
            const cellLinesPerCol: string[][] = [];
            for (let ci = 0; ci < colCount; ci++) {
              const cell = stripEmojis(row[ci] || "");
              const lines = doc.splitTextToSize(cell, colWidths[ci] - 2);
              cellLinesPerCol.push(lines);
              if (lines.length > maxRowHeight) maxRowHeight = lines.length;
            }

            const rowHeight = maxRowHeight * 4 + 2;
            if (y + rowHeight > pageH - MARGIN) {
              addPage();
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
            }

            x = MARGIN;
            for (let ci = 0; ci < colCount; ci++) {
              doc.text(cellLinesPerCol[ci], x + 1, y + 1);
              x += colWidths[ci];
            }

            // Row separator
            y += rowHeight;
            doc.setDrawColor(230, 230, 230);
            doc.line(MARGIN, y, MARGIN + tableWidth, y);
          }

          y += 4;
          break;
        }
        case "hr":
          drawHr();
          break;
      }
    }
  }

  // ── Header (first page only) ──
  // projectName — title
  // Phase: <phaseType>    Date: <DD/MM/YYYY>
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C_GREY);
  const headerLine = `${projectName} — ${title}`;
  doc.text(doc.splitTextToSize(headerLine, localContentW), MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C_LIGHT);
  const dateStr = generatedAt.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.text(`Fase: ${phaseType}    ·    Generado: ${dateStr}`, MARGIN, y);
  y += 6;
  drawHr();

  // ── Body ──
  // If the content already has a top-level heading that matches the title
  // we skip rendering a duplicate title block. Otherwise we emit a clean
  // title block at the top.
  const trimmed = content.trim();
  const firstHeading = trimmed.match(/^#{1,4}\s+(.+)/);
  const alreadyHasTitle =
    firstHeading && stripEmojis(firstHeading[1]).trim().toLowerCase() === stripEmojis(title).trim().toLowerCase();

  if (!alreadyHasTitle) {
    checkSpace(15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...C_BLACK);
    const cleanTitle = stripEmojis(title);
    const titleLines = doc.splitTextToSize(cleanTitle, localContentW);
    doc.text(titleLines, MARGIN, y);
    y += titleLines.length * 8 + 4;
  }

  // Clean and parse
  const cleanContent = cleanJudgeReportPdf(trimmed);
  const blocks = parseMarkdownBlocks(cleanContent);
  writeMdBlocks(blocks);

  // ── Footer (all pages) ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C_LIGHT);
    doc.text(
      `BrewIdea Validator · ${projectName} — ${title}`,
      MARGIN,
      pageH - 8
    );
    doc.text(`Pág. ${i} / ${totalPages}`, PAGE_W - MARGIN, pageH - 8, { align: "right" });
  }

  // Return raw bytes (Buffer) so route handlers can stream it.
  // jsPDF in Node outputs an ArrayBuffer; we copy it into a Node Buffer
  // for the NextResponse contract.
  const ab = doc.output("arraybuffer");
  return Buffer.from(ab);
}
