import { NextResponse } from "next/server";
import { guardProject } from "@/lib/ownership";
import { buildValidationReport } from "@/lib/validation-report";
import { buildReportPdf } from "@/lib/pdf-export";

/**
 * GET /api/projects/[id]/validation/download
 *
 * Returns the consolidated validation report (Phase 0 / Idea validation)
 * as a PDF file.
 *
 * The validation consists of 3 reports (advocate, skeptic, judge) +
 * the idea's metadata + verdict + score, assembled into a single
 * PDF document with clear section dividers.
 *
 * Responses:
 *  - 200: application/pdf body with `Content-Disposition: attachment`.
 *  - 404: project not found, no idea attached, or no reports yet.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;

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

    const pdfBuffer = buildReportPdf({
      title: assembled.title,
      content: assembled.markdown,
      phaseType: assembled.phaseType,
      projectName: assembled.projectName,
    });

    const safeProjectName = assembled.projectName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

    const safeTitle = assembled.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "validacion";

    const filename = `${safeProjectName}-${safeTitle}.pdf`;

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
    console.error("[GET /api/projects/[id]/validation/download]", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
