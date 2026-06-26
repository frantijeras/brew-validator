/**
 * validation-report.ts
 *
 * Helpers to assemble the consolidated validation report for an Idea
 * (Phase 0 of a project). The validation consists of 3 reports
 * (advocate, skeptic, judge) plus the idea's own metadata and the
 * final verdict / score.
 *
 * Used by:
 *   - GET /api/projects/[id]/validation/view     (HTML)
 *   - GET /api/projects/[id]/validation/download  (PDF)
 *
 * We keep this in its own module so both endpoints share the exact
 * same content pipeline.
 */

import { prisma } from "@/lib/db";
import { BUSINESS_MODELS } from "@/lib/business-models";

export interface ValidationReportInput {
  /** Project ID (for scoping — must match `idea.project.id`). */
  projectId: string;
  /** Generation timestamp for header / footer. */
  generatedAt?: Date;
}

export interface ValidationReportResult {
  projectName: string;
  title: string;
  /** Markdown body to feed into buildReportPdf / renderMarkdown. */
  markdown: string;
  /** Phase type label for the header. */
  phaseType: string;
}

const AGENT_LABELS: Record<string, string> = {
  advocate: "Defensor",
  skeptic: "Escéptico",
  judge: "Juez",
};

/**
 * Quita del cuerpo del informe del juez la scorecard que ya vamos a inyectar
 * aparte (tabla derivada del JSON), para no duplicarla. Replica exactamente lo
 * que hace la web (`cleanContent` en markdown-renderer.tsx): elimina las
 * secciones de puntuación/scorecard/tabla de puntuaciones y las tablas
 * sueltas cuyo encabezado tiene "Dimensión" + "Puntuación". NO toca el resto
 * del informe (veredicto, fortalezas, riesgos, recomendaciones, etc.), de modo
 * que el PDF contenga el MISMO contenido que ve el usuario en la web.
 */
function stripBodyScorecard(content: string): string {
  let clean = content;

  // Remove "## Puntuación*" / "## Scorecard*" / "## Tabla de Puntuaciones"
  // sections (header + body up to the next "## " heading).
  const sectionHeaderRe = /^##\s+[^\n]*(puntuación|puntuacion|scorecard|tabla\s+de\s+puntuaciones?|tabla\s+de\s+scores)[^\n]*$/gim;
  const ranges: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = sectionHeaderRe.exec(clean)) !== null) {
    const start = m.index;
    const rest = clean.slice(start + m[0].length);
    const next = rest.search(/^##\s+/m);
    const end = next === -1 ? clean.length : start + m[0].length + next;
    ranges.push({ start, end });
  }
  for (let i = ranges.length - 1; i >= 0; i--) {
    clean = clean.slice(0, ranges[i].start) + clean.slice(ranges[i].end);
  }

  // Remove loose scorecard tables (header row has "Dimensión" + "Puntuación").
  const looseTableRe = /^\|[^\n]*\|[^\n]*\|\s*\n\|[\s:|-]+\|[\s:|-]+\|\s*\n(?:\|[^\n]*\|\s*\n?)+/gm;
  clean = clean.replace(looseTableRe, (match) => {
    const firstLine = match.split("\n")[0].toLowerCase();
    if (/dimensi[oó]n/.test(firstLine) && /(puntuaci[oó]n|puntuacion|score)/.test(firstLine)) return "";
    return match;
  });

  return clean.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Convert a scorecard JSON (string) to a markdown table.
 * Handles both array format [{k,v,d}] and object format {key:value}.
 *
 * Exported so the ideas-export PDF (`generatePdf` in pdf-export.ts) can
 * reuse the exact same table rendering as the project validation PDF.
 */
export function scorecardToMarkdownTable(scorecard: string | null): string {
  if (!scorecard) return "";
  try {
    const parsed = JSON.parse(scorecard);
    let entries: Array<{
      k?: string;
      key?: string;
      v?: number;
      value?: number;
      d?: string;
      description?: string;
    }> = [];
    if (Array.isArray(parsed)) {
      entries = parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      entries = Object.entries(parsed).map(([k, v]) => ({ k, v: v as number }));
    }
    if (entries.length === 0) return "";

    const hasDesc = entries.some((e) => e.d || e.description);
    let md =
      "\n| Dimensión | Puntuación |" +
      (hasDesc ? " Justificación |" : "") +
      "\n";
    md += "|---|---|" + (hasDesc ? "---|" : "") + "\n";
    for (const e of entries) {
      const key = e.k || e.key || "";
      const val =
        typeof e.v === "number"
          ? e.v.toFixed(1)
          : typeof e.value === "number"
            ? e.value.toFixed(1)
            : "—";
      const desc = e.d || e.description || "";
      md +=
        `| ${key} | ${val}/10 |` + (hasDesc ? ` ${desc} |` : "") + "\n";
    }
    return md;
  } catch {
    return "";
  }
}

/**
 * Load the idea + reports for a project, and assemble a single
 * markdown document that consolidates all three validation reports.
 *
 * Throws:
 *   - "project_not_found" if the project doesn't exist.
 *   - "no_idea" if the project has no associated idea.
 *   - "no_reports" if the idea has no validation reports yet.
 */
export async function buildValidationReport(
  params: ValidationReportInput
): Promise<ValidationReportResult> {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      idea: {
        include: {
          reports: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!project) throw new Error("project_not_found");
  if (!project.idea) throw new Error("no_idea");
  if (!project.idea.reports || project.idea.reports.length === 0) {
    throw new Error("no_reports");
  }

  const idea = project.idea;
  const modelInfo = idea.businessModel
    ? BUSINESS_MODELS.find((m) => m.value === idea.businessModel)
    : null;

  // Group reports by agent. We expect exactly 3: advocate, skeptic, judge.
  const byAgent: Record<string, (typeof idea.reports)[number] | undefined> = {};
  for (const r of idea.reports) {
    byAgent[r.agentName] = r;
  }
  const orderedAgents = ["advocate", "skeptic", "judge"];

  const lines: string[] = [];
  lines.push("# Validación de Idea");
  lines.push("");
  lines.push(`**Idea:** ${idea.title}`);
  lines.push("");
  if (idea.description) {
    lines.push(`**Descripción:** ${idea.description}`);
    lines.push("");
  }
  if (idea.problem) {
    lines.push(`**Problema:** ${idea.problem}`);
    lines.push("");
  }
  if (idea.valueProposition) {
    lines.push(`**Propuesta de valor:** ${idea.valueProposition}`);
    lines.push("");
  }
  if (idea.targetUser) {
    lines.push(`**Usuario objetivo:** ${idea.targetUser}`);
    lines.push("");
  }
  if (idea.monetization) {
    lines.push(`**Monetización:** ${idea.monetization}`);
    lines.push("");
  }
  if (modelInfo) {
    lines.push(`**Modelo de negocio:** ${modelInfo.label}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  for (const agent of orderedAgents) {
    const report = byAgent[agent];
    if (!report) continue;
    const label = AGENT_LABELS[agent] || agent;
    lines.push(`## Reporte del ${label}`);
    lines.push("");

    // For the judge, insert the scorecard table before the content so it
    // appears in the PDF (buildReportPdf renders markdown only). Esta tabla
    // (derivada del JSON) es la misma que la web pinta aparte. Si la inyectamos
    // y dejamos también la scorecard que pueda venir EN el cuerpo, saldría
    // duplicada — así que limpiamos el cuerpo igual que hace la web.
    const hasInjectedScorecard =
      agent === "judge" &&
      !!report.scorecard &&
      !!scorecardToMarkdownTable(report.scorecard).trim();
    if (hasInjectedScorecard) {
      lines.push(scorecardToMarkdownTable(report.scorecard));
      lines.push("");
    }

    // Cuerpo del informe. Para el juez con scorecard inyectada quitamos la
    // scorecard del cuerpo (no duplicar), conservando TODO lo demás —
    // exactamente lo que muestra la web. El PDF aplicará el resto de la
    // limpieza (emojis, encabezado de Veredicto, etc.) sin borrar la tabla.
    const body = hasInjectedScorecard
      ? stripBodyScorecard(report.content || "")
      : report.content || "";
    lines.push(body);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Final verdict + score
  if (idea.verdict) {
    lines.push(`## Veredicto final`);
    lines.push("");
    lines.push(`**Veredicto:** ${idea.verdict}`);
    lines.push("");
  }
  if (idea.score !== null && idea.score !== undefined) {
    lines.push(`**Puntuación final:** ${idea.score.toFixed(1)}/10`);
    lines.push("");
  }

  return {
    projectName: project.name,
    title: "Validación de Idea",
    markdown: lines.join("\n"),
    phaseType: "VALIDATION",
  };
}
