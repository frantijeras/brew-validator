import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildReportPdf } from "@/lib/pdf-export";
import {
  buildBrandBook,
  brandBookToMarkdown,
} from "@/lib/identity-brandbook";

/**
 * GET /api/projects/[id]/phases/[phaseId]/brandbook/download
 *
 * Returns the consolidated Brand Book as a downloadable PDF file.
 *
 * Only works for IDENTITY phases on the `final` sub-step. If the
 * sub-step artifact is available, it uses that content directly
 * (with HTML tag stripping for PDF compatibility). Otherwise, it
 * builds the Brand Book on-the-fly from available sub-step data.
 *
 * Responses:
 *  - 200: application/pdf body with Content-Disposition: attachment.
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

    // Resolve content: prefer agent-generated artifact, fall back to
    // on-the-fly generation.
    const subArtifact = phase.subStepArtifact as
      | { type?: "html" | "markdown"; content?: string; title?: string }
      | null;

    let title = "Brand Book";
    let rawContent = "";
    let contentIsHtml = false;

    if (subArtifact?.content && subArtifact.content.trim().length > 0) {
      rawContent = subArtifact.content;
      contentIsHtml = subArtifact.type === "html";
      if (subArtifact.title) title = subArtifact.title;
    } else {
      // Build on-the-fly.
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
      contentIsHtml = false;
      title = `Brand Book — ${phase.project.name}`;
    }

    if (!rawContent) {
      return NextResponse.json(
        { error: "No hay contenido disponible para el Brand Book" },
        { status: 404 }
      );
    }

    // For HTML content, strip tags for PDF compatibility.
    let pdfInput = rawContent;
    if (contentIsHtml) {
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
    }

    const pdfBuffer = buildReportPdf({
      title,
      content: pdfInput,
      phaseType: "IDENTITY",
      projectName: phase.project.name,
    });

    const safeTitle = title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "brand-book";

    const filename = `${safeTitle}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/projects/[id]/phases/[phaseId]/brandbook/download]",
      error
    );
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
