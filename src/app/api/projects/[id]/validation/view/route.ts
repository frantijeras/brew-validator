import { NextResponse } from "next/server";
import { buildValidationReport } from "@/lib/validation-report";
import { buildReportHtml } from "@/lib/report-renderer";

/**
 * GET /api/projects/[id]/validation/view
 *
 * Returns the consolidated validation report (Phase 0 / Idea validation)
 * as a self-contained HTML page.
 *
 * The validation consists of 3 reports (advocate, skeptic, judge) +
 * the idea's metadata + verdict + score. This is what the user
 * already sees on the ideas page, but assembled into a single
 * readable document with the "Imprimir / Guardar como PDF" button.
 *
 * Responses:
 *  - 200: text/html body (inline).
 *  - 404: project not found, no idea attached, or no reports yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
