import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { resolve3dAssets } from "@/lib/identity-3d";

/**
 * GET /api/projects/[id]/phases/[phaseId]/substep/3d/template?variant=A|B|C
 *
 * Descarga la **maqueta HTML** (la variante de estilo visual elegida con el
 * logotipo SVG incrustado) como `index.html`.
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

    const variant = new URL(req.url).searchParams.get("variant");
    const assets = resolve3dAssets(phase, variant, project?.name || "Proyecto");
    if (!assets) {
      return NextResponse.json(
        { error: "No visual style artifact available for 3d" },
        { status: 404 }
      );
    }

    return new NextResponse(assets.maquetaHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="index.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/projects/[id]/phases/[phaseId]/substep/3d/template]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
