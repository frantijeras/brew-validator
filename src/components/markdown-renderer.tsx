/**
 * Basic markdown to HTML renderer.
 * No external dependencies — parses common markdown syntax.
 */

export function renderMarkdown(markdown: string): string {
  if (!markdown) return "";

  let html = markdown;

  // Escape HTML entities first (except what we'll inject)
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

  // Tables
  html = renderTables(html);

  // Horizontal rules
  html = html.replace(/^(---|\*\*\*|___)\s*$/gm, '<hr class="my-4 border-slate-700" />');

  // Blockquotes
  html = html.replace(
    /^(> .*(?:\n> .*)*)/gm,
    '<blockquote class="my-2 border-l-2 border-amber-500/50 pl-4 text-slate-400 italic">$1</blockquote>'
  );

  // Unordered list items
  html = html.replace(
    /^[\t ]*[-*+] (.+)$/gm,
    '<li class="ml-4 list-disc text-slate-300">$1</li>'
  );

  // Ordered list items
  html = html.replace(
    /^[\t ]*\d+\. (.+)$/gm,
    '<li class="ml-4 list-decimal text-slate-300">$1</li>'
  );

  // Wrap consecutive list items in <ul> or <ol>
  html = html.replace(
    /(<li class="ml-4 list-disc[^"]*">.*?<\/li>)(\s*(?=<li class="ml-4 list-disc))/g,
    '$1'
  );

  // Headings (must be after other line-based transforms)
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

  // Line breaks (double newline → paragraph)
  html = html.replace(/\n\n+/g, "</p><p>");
  html = "<p>" + html + "</p>";

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>\s*<hr/g, "<hr");
  html = html.replace(/\/>\s*<\/p>/g, "/>");

  return html;
}

function renderTables(markdown: string): string {
  // Match a table: header row + separator + body rows
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
        '<div class="my-4 overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-slate-700">';

      for (const h of headers) {
        tableHtml += `<th class="px-4 py-2 text-left font-semibold text-slate-200">${h}</th>`;
      }

      tableHtml += "</tr></thead><tbody>";

      for (let i = 0; i < rows.length; i++) {
        const isLast = i === rows.length - 1;
        tableHtml += `<tr class="${isLast ? "" : "border-b border-slate-800"}">`;
        for (const cell of rows[i]) {
          tableHtml += `<td class="px-4 py-2 text-slate-300">${cell}</td>`;
        }
        tableHtml += "</tr>";
      }

      tableHtml += "</tbody></table></div>";
      return tableHtml;
    }
  );
}
