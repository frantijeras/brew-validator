import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { resolve3dAssets } from "@/lib/identity-3d";
import { buildReportPdf } from "@/lib/pdf-export";

/**
 * GET /api/projects/[id]/phases/[phaseId]/substep/3d/styleguide?variant=A|B|C
 *
 * Guía de Estilo de la sub-fase 3d (colores HEX, fuentes, dirección visual).
 *
 * - `?format=html` → devuelve la guía como HTML autocontenible CON el logotipo
 *   SVG incrustado (inline). El cliente la usa para generar el PDF con el SVG
 *   renderizado por el navegador (html2canvas + jsPDF).
 * - por defecto → devuelve un PDF generado en servidor (texto: colores y
 *   fuentes documentados) como `guia-estilos.pdf`. El SVG va incrustado en el
 *   template `template.html` y como `logo.svg` en el hand-off.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    const [phase, project] = await Promise.all([
      prisma.projectPhase.findFirst({ where: { id: phaseId, projectId } }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      }),
    ]);
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const variant = url.searchParams.get("variant");
    const format = url.searchParams.get("format");
    const projectName = project?.name || "Proyecto";
    const assets = resolve3dAssets(phase, variant, projectName);
    if (!assets) {
      return NextResponse.json(
        { error: "No visual style artifact available for 3d" },
        { status: 404 }
      );
    }

    if (format === "html") {
      return new NextResponse(assets.styleGuideHtml, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const pdf = buildReportPdf({
      title: `Guía de Estilo — ${projectName}`,
      content: assets.styleGuideMarkdown,
      phaseType: "IDENTITY",
      projectName,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="guia-estilos.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/projects/[id]/phases/[phaseId]/substep/3d/styleguide]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
