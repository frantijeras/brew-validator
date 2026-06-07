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
    // The report.content is already cleaned by `cleanJudgeReport` in the
    // web UI; the PDF pipeline applies the same cleanup defensively. We
    // pass it through as-is.
    lines.push(report.content || "");
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
