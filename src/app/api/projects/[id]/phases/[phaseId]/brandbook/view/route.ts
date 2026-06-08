import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildReportHtml } from "@/lib/report-renderer";
import {
  buildBrandBook,
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

    // Try to use the existing sub-step artifact if the agent already
    // generated the Brand Book and stored it in `subStepArtifact`.
    const subArtifact = phase.subStepArtifact as
      | { type?: "html" | "markdown"; content?: string; title?: string }
      | null;

    let title = "Brand Book";
    let rawContent = "";
    let contentType: "markdown" | "html" = "markdown";

    if (subArtifact?.content && subArtifact.content.trim().length > 0) {
      // Agent already generated the Brand Book artifact.
      rawContent = subArtifact.content;
      contentType = subArtifact.type === "html" ? "html" : "markdown";
      if (subArtifact.title) title = subArtifact.title;
    } else {
      // Build on-the-fly from available data.
      const visualArtifactJson = (phase.subStepArtifact as { content?: string } | null)?.content ?? null;

      const brandBook = buildBrandBook({
        projectName: phase.project.name,
        namingContent: phase.subStepChoice ?? null,
        voiceContent: null,
        visualChoice: phase.subStepChoice ?? null,
        visualArtifactJson,
        projectContext: { description: phase.project.description },
      });

      rawContent = brandBookToMarkdown(brandBook);
      contentType = "markdown";
      title = `Brand Book — ${phase.project.name}`;
    }

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
