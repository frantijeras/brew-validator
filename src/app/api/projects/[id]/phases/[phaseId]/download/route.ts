import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildReportPdf } from "@/lib/pdf-export";

/**
 * GET /api/projects/[id]/phases/[phaseId]/download
 *
 * Returns the report of a COMPLETED phase as a **PDF** file.
 *
 * Source content is resolved as follows:
 *  1. If the phase is IDENTITY and is on the `final` sub-step, use
 *     `subStepArtifact.content` (the consolidated Brand Book, usually
 *     HTML).
 *  2. Otherwise, use the first entry in `artifacts[].content`
 *     (markdown body for the rest of the phases).
 *
 * Markdown content is cleaned up the same way the web UI does (judge
 * scorecard duplicates, decorative emojis), so the PDF matches what
 * the user sees in the browser.
 *
 * Responses:
 *  - 200: application/pdf body with `Content-Disposition: attachment`.
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

    // Resolve content: prefer the IDENTITY `final` sub-step artifact
    // (the Brand Book), fall back to the first main artifact.
    let title = phase.label || "Reporte";
    let rawContent = "";
    let contentIsHtml = false;

    if (phase.type === "IDENTITY" && phase.subStep === "final") {
      const subArtifact = phase.subStepArtifact as
        | { type?: "html" | "markdown"; content?: string; title?: string }
        | null;
      if (subArtifact?.content) {
        rawContent = subArtifact.content;
        contentIsHtml = subArtifact.type === "html";
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
        contentIsHtml = first.type === "html";
        if (first.title) title = first.title;
      }
    }

    if (!rawContent) {
      return NextResponse.json(
        { error: "No hay contenido disponible para esta fase" },
        { status: 404 }
      );
    }

    // For HTML content (style guide), strip HTML tags so jsPDF can render
    // a plain-text approximation. The HTML view endpoint preserves the
    // full HTML; the PDF is a simpler text rendition of the same content.
    let pdfInput = rawContent;
    if (contentIsHtml) {
      // Strip HTML tags but keep some structure markers (# for headings,
      // newlines for block boundaries).
      pdfInput = rawContent
        .replace(/<\/?(h[1-4])[^>]*>/gi, "\n\n## ")
        .replace(/<\/?(p|div|li|tr|blockquote)[^>]*>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } else {
      // `buildReportPdf` applies the judge cleanup internally, so we just
      // pass the markdown through.
      pdfInput = rawContent;
    }

    const pdfBuffer = buildReportPdf({
      title,
      content: pdfInput,
      phaseType: phase.type,
      projectName: phase.project.name,
    });

    const safeTitle = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "reporte";

    const filename = `${safeTitle}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/projects/[id]/phases/[phaseId]/download]", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
