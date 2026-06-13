import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { resolve3dAssets, buildIntegratedViewHtml } from "@/lib/identity-3d";

/**
 * GET /api/projects/[id]/phases/[phaseId]/substep/3d/view?variant=A|B|C
 *
 * Vista INTEGRADA (inline) de la sub-fase 3d: muestra la Guía de Estilo y la
 * maqueta (con el logotipo SVG incrustado) una junto a otra, cada una aislada
 * en su iframe para que sus estilos no rompan la pantalla. Pensado para abrir
 * en una pestaña nueva desde el botón "Ver".
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

    const urlObj = new URL(req.url);
    const variant = urlObj.searchParams.get("variant");
    const part = urlObj.searchParams.get("part");
    const assets = resolve3dAssets(phase, variant, project?.name || "Proyecto");
    if (!assets) {
      return NextResponse.json(
        { error: "No visual style artifact available for 3d" },
        { status: 404 }
      );
    }

    // `part=guia|maqueta` → documento HTML autónomo individual (para mostrar en
    // pestañas separadas dentro de la subpágina). Sin `part` → vista integrada
    // (compatibilidad: abrir en pestaña nueva muestra ambas).
    if (part === "guia" || part === "maqueta") {
      const single = part === "guia" ? assets.styleGuideHtml : assets.maquetaHtml;
      return new NextResponse(single, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const html = buildIntegratedViewHtml({
      projectName: project?.name || "Proyecto",
      variant: assets.variant,
      maquetaHtml: assets.maquetaHtml,
      styleGuideHtml: assets.styleGuideHtml,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/projects/[id]/phases/[phaseId]/substep/3d/view]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
