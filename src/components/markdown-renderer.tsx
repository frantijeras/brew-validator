/**
 * Markdown → HTML renderer.
 * Handles tables, headings, lists (ordered + unordered), bold, italic,
 * code, links, blockquotes, and horizontal rules.
 *
 * Fixes vs. previous version:
 * - Proper <ol>/<ul> wrapping (consecutive <li> items are grouped)
 * - Judge report cleanup: removes duplicate scorecard sections and
 *   decorative emojis that pollute the output
 * - Better handling of multi-line list items
 */

// ── Judge report cleanup ──────────────────────────────────────────────
// The judge LLM tends to produce duplicate scorecard tables, emojis,
// and repeated score lines. We clean that up before rendering.

const JUDGE_EMOJI_REGEX = /[📊⭐✅🎯🏆💪🔍❌📈📋✨🔥💡⚖️🛡️🚀💰]/g;

function cleanJudgeReport(markdown: string, agentName?: string): string {
  if (agentName !== "judge") return markdown;

  let clean = markdown;

  // Strip replacement characters and other invalid glyphs the LLM sometimes emits
  clean = clean.replace(/\uFFFD/g, "");

  // Remove decorative emojis
  clean = clean.replace(JUDGE_EMOJI_REGEX, "");

  // Remove duplicate "## Scorecard" sections (keep only the first one)
  const scorecardMatches = [...clean.matchAll(/^## Scorecard[\s\S]*?(?=^## |\n---|\n\n\n|$)/gim)];
  if (scorecardMatches.length > 1) {
    for (let i = 1; i < scorecardMatches.length; i++) {
      clean = clean.replace(scorecardMatches[i][0], "");
    }
  }

  // Remove "## Decisión" section (not in spec)
  clean = clean.replace(/^## Decisión[\s\S]*?(?=^## |$)/gm, "");

  // Remove any "## Puntuación*" / "## Scorecard*" / "## Tabla de Puntuaciones"
  // section — the scorecard is rendered separately in the ReportViewer
  // table from the scorecard JSON, so showing it in the markdown body
  // duplicates the scores. The LLM varies the title (## Puntuación,
  // ## Puntuación Final, ## Puntuación:, ## Tabla de Puntuaciones, etc.)
  // so we match case-insensitively on keywords.
  const sectionHeaderRe = /^##\s+[^\n]*(puntuación|puntuacion|scorecard|tabla\s+de\s+puntuaciones?|tabla\s+de\s+scores)[^\n]*$/gim;
  const sectionRanges: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = sectionHeaderRe.exec(clean)) !== null) {
    const start = m.index;
    // Find the next "## " section header (start of next section) or end of doc
    const rest = clean.slice(start + m[0].length);
    const nextSection = rest.search(/^##\s+/m);
    const end = nextSection === -1 ? clean.length : start + m[0].length + nextSection;
    sectionRanges.push({ start, end });
  }
  // Apply in reverse so earlier indexes stay valid
  for (let i = sectionRanges.length - 1; i >= 0; i--) {
    const { start, end } = sectionRanges[i];
    clean = clean.slice(0, start) + clean.slice(end);
  }

  // Remove loose scorecard tables (no ## header) — look for a markdown
  // table whose header row contains both "Dimensión" (or "Dimension") and
  // "Puntuación" (or "Puntuacion"/"Score"). If found, remove the whole
  // table (header + separator + all body rows).
  const looseTableRe = /^\|[^\n]*\|[^\n]*\|\s*\n\|[\s:|-]+\|[\s:|-]+\|\s*\n(?:\|[^\n]*\|\s*\n?)+/gm;
  clean = clean.replace(looseTableRe, (match) => {
    const firstLine = match.split("\n")[0].toLowerCase();
    const hasDim = /dimensi[oó]n/.test(firstLine);
    const hasPunt = /(puntuaci[oó]n|puntuacion|score)/.test(firstLine);
    // Only remove if it looks like a scorecard table (small, ~8-10 columns
    // usually, but we don't filter on column count to keep it simple)
    if (hasDim && hasPunt) return "";
    return match;
  });

  // Join prose lines that the LLM broke mid-paragraph.
  // The LLM sometimes inserts \n in the middle of a sentence.
  // We want to keep real paragraph breaks (blank lines) but join
  // soft wraps within the same paragraph.
  // Strategy: normalize to single \n between non-blank lines that
  // don't start with markdown structures.
  clean = clean.replace(/(?<!\n)\n(?!\n|#{1,6}\s|\*\*|\d+\.\s|-\s|\|\s*\|)/g, " ");

  // Clean up multiple blank lines
  clean = clean.replace(/\n{3,}/g, "\n\n");

  return clean.trim();
}

// ── Main renderer ─────────────────────────────────────────────────────

export function renderMarkdown(markdown: string, agentName?: string): string {
  if (!markdown) return "";

  // Clean reports before rendering
  let html = cleanJudgeReport(markdown, agentName);

  // Remove emojis from ALL agent reports (they pollute the output)
  if (agentName && agentName !== "idea-generator") {
    html = html.replace(JUDGE_EMOJI_REGEX, "");
  }

  // For skeptic and advocate: remove the ENTIRE "## Veredicto" section (header + content)
  // because they should not issue verdicts.
  if (agentName === "skeptic" || agentName === "advocate") {
    html = html.replace(/^## Veredicto[\s\S]*?(?=^## |$)/gm, "");
  }

  // For judge: remove ONLY the "## Veredicto" header line, keep the content.
  // The LLM writes both a ## Veredicto header AND starts the body with
  // "**Verdicto: Pulir idea**" — keeping both creates a visible
  // "Veredicto Veredicto" duplication in the UI.
  if (agentName === "judge") {
    html = html.replace(/^## Veredicto\s*\n+/gm, "");
  }

  // Escape HTML entities (except what we'll inject)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (```)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang: string, code: string) => {
      const language = lang || "";
      return `<pre class="my-3 rounded-lg bg-slate-800 p-4 overflow-x-auto"><code class="text-sm text-slate-200 ${language ? `language-${language}` : ""}">${code.trim()}</code></pre>`;
    }
  );

  // Inline code (`)
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-amber-300 font-mono">$1</code>'
  );

  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic (*text* or _text_) — but not inside words
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>");

  // Tables (before list processing)
  html = renderTables(html);

  // Horizontal rules
  html = html.replace(/^(---|\*\*\*|___)\s*$/gm, '<hr class="my-4 border-slate-700" />');

  // Blockquotes (> text)
  html = html.replace(
    /^&gt;\s*(.+)$/gm,
    '<blockquote class="my-2 border-l-2 border-amber-500/50 pl-4 text-slate-400 italic">$1</blockquote>'
  );

  // Headings (process BEFORE lists to avoid conflicts)
  html = html.replace(
    /^#### (.+)$/gm,
    '<h4 class="mt-4 mb-2 text-base font-semibold text-slate-200">$1</h4>'
  );
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="mt-5 mb-2 text-lg font-semibold text-white">$1</h3>'
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 class="mt-6 mb-3 text-xl font-bold text-white">$1</h2>'
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<h1 class="mt-6 mb-4 text-2xl font-bold text-white">$1</h1>'
  );

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-amber-400 hover:text-amber-300 underline" target="_blank" rel="noopener">$1</a>'
  );

  // ── List processing ──
  // We process lists in a dedicated pass to properly wrap <ol>/<ul>.

  // Ordered list items: "1. text" or "  1. text"
  // Use a placeholder to protect them from the paragraph split
  const OL_PLACEHOLDER = "%%OL_ITEM_";
  const UL_PLACEHOLDER = "%%UL_ITEM_";
  const olItems: string[] = [];
  const ulItems: string[] = [];

  // Collect ordered list items
  html = html.replace(
    /^[\t ]*(\d+)\.\s+(.+)$/gm,
    (_match, _num: string, text: string) => {
      const idx = olItems.length;
      olItems.push(text);
      return `${OL_PLACEHOLDER}${idx}%%`;
    }
  );

  // Collect unordered list items: "- text", "* text", "+ text"
  html = html.replace(
    /^[\t ]*[-*+]\s+(.+)$/gm,
    (_match, text: string) => {
      const idx = ulItems.length;
      ulItems.push(text);
      return `${UL_PLACEHOLDER}${idx}%%`;
    }
  );

  // Now split into paragraphs (double newline)
  html = html.replace(/\n\n+/g, "\n<!--PARA-->\n");
  const blocks = html.split("\n<!--PARA-->\n");

  const processedBlocks = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";

    // Check if this block is a sequence of OL items
    const olMatch = trimmed.match(new RegExp(`^(${OL_PLACEHOLDER}\\d+%%\\s*)+$`));
    if (olMatch) {
      const items = trimmed.match(new RegExp(`${OL_PLACEHOLDER}(\\d+)%%`, "g")) || [];
      const lis = items
        .map((ph) => {
          const idx = parseInt(ph.replace(OL_PLACEHOLDER, "").replace("%%", ""));
          return `<li class="ml-5 list-decimal text-slate-300 mb-1">${olItems[idx] || ""}</li>`;
        })
        .join("\n");
      return `<ol class="my-3 space-y-1">${lis}</ol>`;
    }

    // Check if this block is a sequence of UL items
    const ulMatch = trimmed.match(new RegExp(`^(${UL_PLACEHOLDER}\\d+%%\\s*)+$`));
    if (ulMatch) {
      const items = trimmed.match(new RegExp(`${UL_PLACEHOLDER}(\\d+)%%`, "g")) || [];
      const lis = items
        .map((ph) => {
          const idx = parseInt(ph.replace(UL_PLACEHOLDER, "").replace("%%", ""));
          return `<li class="ml-5 list-disc text-slate-300 mb-1">${ulItems[idx] || ""}</li>`;
        })
        .join("\n");
      return `<ul class="my-3 space-y-1">${lis}</ul>`;
    }

    // Regular paragraph — wrap if it's not already a block element
    if (
      trimmed.startsWith("<h") ||
      trimmed.startsWith("<pre") ||
      trimmed.startsWith("<table") ||
      trimmed.startsWith("<div") ||
      trimmed.startsWith("<blockquote") ||
      trimmed.startsWith("<hr") ||
      trimmed.startsWith("<ol") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("<li")
    ) {
      return trimmed;
    }

    return `<p class="mb-3 text-slate-300 leading-relaxed">${trimmed}</p>`;
  });

  html = processedBlocks.filter(Boolean).join("\n");

  // Merge adjacent <ol> blocks into a single continuous list.
  // The LLM sometimes emits a numbered list with a blank line between
  // items (or restarts numbering mid-list), and the paragraph splitter
  // above turns that into several separate <ol> elements, each starting
  // back at 1. Collapse them so the browser renumbers 1, 2, 3…
  // continuously. Same treatment for <ul> blocks.
  let prevHtml = "";
  while (prevHtml !== html) {
    prevHtml = html;
    html = html.replace(/<\/ol>(\s*)<ol[^>]*>/g, "$1");
    html = html.replace(/<\/ul>(\s*)<ul[^>]*>/g, "$1");
  }

  // Clean up any remaining placeholder artifacts
  html = html.replace(new RegExp(`${OL_PLACEHOLDER}\\d+%%`, "g"), "");
  html = html.replace(new RegExp(`${UL_PLACEHOLDER}\\d+%%`, "g"), "");

  // Clean up empty paragraphs and stray whitespace
  html = html.replace(/<p[^>]*>\s*<\/p>/g, "");
  html = html.replace(/\n{3,}/g, "\n\n");

  return html.trim();
}

// ── Table renderer ────────────────────────────────────────────────────

function renderTables(markdown: string): string {
  const tableRegex = /^\|(.+)\|\n\|([-| :]+)\|\n((?:\|.+\|\n?)*)/gm;

  return markdown.replace(
    tableRegex,
    (
      _match: string,
      headerRow: string,
      _separator: string,
      bodyRows: string
    ) => {
      const headers = headerRow
        .split("|")
        .map((h: string) => h.trim())
        .filter(Boolean);
      const rows = bodyRows
        .trim()
        .split("\n")
        .map((row: string) =>
          row
            .split("|")
            .map((c: string) => c.trim())
            .filter(Boolean)
        );

      let tableHtml =
        '<div class="my-4 overflow-x-auto rounded-lg border border-slate-700" style="max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;margin:1rem 0;"><table class="w-full text-sm" style="min-width:100%;border-collapse:collapse;">';

      // Header
      tableHtml += '<thead><tr class="border-b border-slate-700 bg-slate-800/50">';
      for (const h of headers) {
        tableHtml += `<th class="px-4 py-2.5 text-left font-semibold text-slate-200">${h}</th>`;
      }
      tableHtml += "</tr></thead><tbody>";

      // Body
      for (let i = 0; i < rows.length; i++) {
        const isLast = i === rows.length - 1;
        tableHtml += `<tr class="${isLast ? "" : "border-b border-slate-800"}">`;
        for (const cell of rows[i]) {
          tableHtml += `<td class="px-4 py-2.5 text-slate-300">${cell}</td>`;
        }
        tableHtml += "</tr>";
      }

      tableHtml += "</tbody></table></div>";
      return tableHtml;
    }
  );
}
