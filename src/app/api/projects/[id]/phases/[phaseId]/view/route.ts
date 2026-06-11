import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { buildReportHtml } from "@/lib/report-renderer";

/**
 * GET /api/projects/[id]/phases/[phaseId]/view
 *
 * Returns the report of a COMPLETED phase as a **standalone HTML page**
 * suitable for opening in a new browser tab (no download forced).
 *
 * Source content resolution is identical to `/download`:
 *  1. IDENTITY + subStep `final` → use `subStepArtifact` (HTML).
 *  2. Otherwise → first entry in `artifacts[]` (markdown).
 *
 * Responses:
 *  - 200: text/html body (inline) with `Cache-Control: no-store`.
 *  - 404: project / phase not found, or phaseId does not belong to
 *         the project, or no content available.
 *  - 409: phase is not COMPLETED yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id, phaseId } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;

    const phase = await prisma.projectPhase.findUnique({
      where: { id: phaseId },
      include: { project: true },
    });

    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }
    if (phase.projectId !== id) {
      return NextResponse.json(
        { error: "Phase does not belong to project" },
        { status: 404 }
      );
    }
    if (phase.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Phase is not completed yet" },
        { status: 409 }
      );
    }

    // Resolve content (same logic as the download route).
    let title = phase.label || "Reporte";
    let rawContent = "";
    let contentType: "markdown" | "html" = "markdown";

    if (phase.type === "IDENTITY" && (phase.subStep === "final" || phase.subStep === "visual")) {
      const subArtifact = phase.subStepArtifact as
        | { type?: "html" | "markdown"; content?: string; title?: string }
        | null;
      if (subArtifact?.content) {
        rawContent = subArtifact.content;
        contentType = subArtifact.type === "html" ? "html" : "markdown";
        if (subArtifact.title) title = subArtifact.title;
      }
    }

    if (!rawContent) {
      const artifacts = phase.artifacts as
        | Array<{ title?: string; content?: string; type?: string }>
        | null;
      const first = artifacts && artifacts.length > 0 ? artifacts[0] : null;
      if (first?.content) {
        rawContent = first.content;
        contentType = first.type === "html" ? "html" : "markdown";
        if (first.title) title = first.title;
      }
    }

    if (!rawContent) {
      return NextResponse.json(
        { error: "No hay contenido disponible para esta fase" },
        { status: 404 }
      );
    }

    const html = buildReportHtml({
      title,
      content: rawContent,
      contentType,
      projectName: phase.project.name,
      phaseType: phase.type,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // No Content-Disposition: inline → the browser opens the page
        // in the new tab rather than triggering a download.
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    console.error("[GET /api/projects/[id]/phases/[phaseId]/view]", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
