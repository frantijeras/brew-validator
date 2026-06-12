import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";

/**
 * GET /api/projects/[id]/phases/[phaseId]/content
 *
 * Returns the report of a COMPLETED phase as JSON:
 *   { title, content, contentType: "markdown" | "html" }
 *
 * Source content resolution:
 *  1. IDENTITY + subStep `final` → use `subStepArtifact`.
 *  2. Otherwise → first entry in `artifacts[]`.
 *
 * Responses:
 *  - 200: JSON { title, content, contentType }
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

    // Resolve content (same logic as the view route).
    // Para una fase COMPLETADA usamos siempre `artifacts[0]` (el informe
    // consolidado). En IDENTITY eso es el resumen de identidad; el JSON del
    // sub-paso visual (subStepArtifact) NO es un documento para el usuario.
    let title = phase.label || "Reporte";
    let rawContent = "";
    let contentType: "markdown" | "html" = "markdown";

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

    return NextResponse.json(
      { title, content: rawContent, contentType },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/projects/[id]/phases/[phaseId]/content]", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
