import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { getChosenLogoSvg } from "@/lib/identity-logo";

/**
 * GET /api/projects/[id]/phases/[phaseId]/substep/logo-download
 *
 * Descarga del artefacto de la sub-fase 3c (Logotipo).
 *
 * - Sin query: descarga el documento HTML completo con las 12 propuestas
 *   de logo en SVG (Gráficos vectoriales redimensionables) →
 *   `logos-options.html`.
 * - `?svg=1` (o un índice): descarga solo el SVG elegido (o el indicado)
 *   como `logo.svg`. Si no se indica índice, usa `subStepChoice`.
 *
 * El modal muestra el HTML en un `<iframe srcDoc>` (no permite "Guardar
 * como…"), por eso este endpoint sirve el contenido con
 * `Content-Disposition: attachment`.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    const artifact = phase.subStepArtifact as
      | { type?: string; content?: string }
      | null;
    const html = artifact?.content;
    if (!html) {
      return NextResponse.json(
        { error: "No logo artifact available" },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const svgParam = url.searchParams.get("svg");

    if (svgParam != null) {
      // Descargar solo el SVG elegido (o el índice indicado en ?svg=N).
      const choice = svgParam === "" ? phase.subStepChoice : svgParam;
      const svg = getChosenLogoSvg(html, choice);
      if (!svg) {
        return NextResponse.json(
          { error: "Chosen logo SVG not found" },
          { status: 404 }
        );
      }
      return new NextResponse(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="logo.svg"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Descargar el documento HTML completo con las 12 propuestas.
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="logos-options.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/projects/[id]/phases/[phaseId]/substep/logo-download]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
