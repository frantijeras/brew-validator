import { NextResponse } from "next/server";
import { buildValidationReport } from "@/lib/validation-report";
import { buildReportHtml } from "@/lib/report-renderer";
import { prisma } from "@/lib/db";

/**
 * GET /api/projects/[id]/validation/view
 *
 * Returns the consolidated validation report (Phase 0 / Idea validation).
 *
 * Without `?format=json` → self-contained HTML page (browser "Ver" flow).
 * With    `?format=json` → JSON payload for the inline page component:
 *   {
 *     reports: Array<{ agentName, title, content }>,
 *     score: number | null,
 *     verdict: string | null,
 *     ideaTitle: string,
 *     projectName: string
 *   }
 *
 * Responses:
 *  - 200: text/html (default) or application/json (format=json).
 *  - 404: project not found, no idea attached, or no reports yet.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const format = url.searchParams.get("format");

    // ── JSON mode: return raw data for the inline page component ──
    if (format === "json") {
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          idea: {
            include: {
              reports: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  agentName: true,
                  title: true,
                  content: true,
                  createdAt: true,
                  scorecard: true,
                  verdict: true,
                },
              },
            },
          },
        },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Proyecto no encontrado" },
          { status: 404 }
        );
      }
      if (!project.idea) {
        return NextResponse.json(
          { error: "Esta idea aún no tiene reportes de validación" },
          { status: 404 }
        );
      }
      if (!project.idea.reports || project.idea.reports.length === 0) {
        return NextResponse.json(
          { error: "Esta idea aún no tiene reportes de validación" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          reports: project.idea.reports.map((r) => ({
            id: r.id,
            agentName: r.agentName,
            title: r.title,
            content: r.content,
            createdAt: r.createdAt,
            scorecard: r.scorecard,
            verdict: r.verdict,
          })),
          score: project.idea.score ?? null,
          verdict: project.idea.verdict ?? null,
          ideaTitle: project.idea.title,
          projectName: project.name,
          idea: {
            title: project.idea.title,
            description: project.idea.description,
            problem: project.idea.problem ?? null,
            valueProposition: project.idea.valueProposition ?? null,
            targetUser: project.idea.targetUser,
            monetization: project.idea.monetization,
            businessModel: project.idea.businessModel ?? null,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        }
      );
    }

    // ── HTML mode: self-contained document ──
    let assembled;
    try {
      assembled = await buildValidationReport({ projectId: id });
    } catch (err) {
      const code = err instanceof Error ? err.message : "internal";
      if (code === "project_not_found") {
        return NextResponse.json(
          { error: "Proyecto no encontrado" },
          { status: 404 }
        );
      }
      if (code === "no_idea" || code === "no_reports") {
        return NextResponse.json(
          { error: "Esta idea aún no tiene reportes de validación" },
          { status: 404 }
        );
      }
      throw err;
    }

    const html = buildReportHtml({
      title: assembled.title,
      content: assembled.markdown,
      contentType: "markdown",
      projectName: assembled.projectName,
      phaseType: assembled.phaseType,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    console.error("[GET /api/projects/[id]/validation/view]", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
