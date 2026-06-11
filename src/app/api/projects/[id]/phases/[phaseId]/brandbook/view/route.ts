import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildReportHtml } from "@/lib/report-renderer";
import {
  buildBrandBookFromPhase,
  brandBookToMarkdown,
} from "@/lib/identity-brandbook";

/**
 * GET /api/projects/[id]/phases/[phaseId]/brandbook/view
 *
 * Returns the consolidated Brand Book as a self-contained HTML page
 * suitable for opening in a new browser tab.
 *
 * Only works for IDENTITY phases on the `final` sub-step. If the
 * sub-step artifact is available (the agent already generated the
 * Brand Book), it uses that content directly. Otherwise, it builds
 * the Brand Book on-the-fly from available sub-step data.
 *
 * Responses:
 *  - 200: text/html body (inline).
 *  - 404: project / phase not found, or phaseId does not belong to project.
 *  - 409: phase is not IDENTITY or not on the `final` sub-step.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
      include: { project: true },
    });

    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    if (phase.type !== "IDENTITY") {
      return NextResponse.json(
        { error: "Brand Book only available for IDENTITY phases" },
        { status: 409 }
      );
    }

    if (phase.subStep !== "final" && phase.subStep !== "visual") {
      return NextResponse.json(
        { error: "Brand Book only available on the `final` or `visual` sub-step" },
        { status: 409 }
      );
    }

    // Always consolidate the Brand Book from the per-sub-step history (naming
    // + voice + visual chosen options). We do NOT render `subStepArtifact`
    // directly: for a completed phase that field holds the visual artifact
    // (JSON/HTML), not the Brand Book.
    const brandBook = buildBrandBookFromPhase(phase, phase.project.name, {
      description: phase.project.description,
    });
    const rawContent = brandBookToMarkdown(brandBook);
    const contentType: "markdown" | "html" = "markdown";
    const title = `Brand Book — ${phase.project.name}`;

    if (!rawContent) {
      return NextResponse.json(
        { error: "No hay contenido disponible para el Brand Book" },
        { status: 404 }
      );
    }

    const html = buildReportHtml({
      title,
      content: rawContent,
      contentType,
      projectName: phase.project.name,
      phaseType: "IDENTITY",
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
    console.error(
      "[GET /api/projects/[id]/phases/[phaseId]/brandbook/view]",
      error
    );
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
