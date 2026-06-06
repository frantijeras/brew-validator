import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/projects/[id]/phases/[phaseId]/substep/artifact
 *
 * Devuelve el artefacto intermedio (subStepArtifact) y opciones de la fase.
 * El frontend lo llama al abrir el modal de sub-paso para refrescar el
 * contenido sin tener que hacer router.refresh() del server component.
 *
 * Auth: implícita por el join projectId → ideaId → user (los handlers de
 * proyecto no se exponen públicamente hoy; las páginas requieren sesión vía
 * next-auth). El proyecto debe pertenecer a la fase solicitada.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    const artifact = phase.subStepArtifact as
      | { type?: string; content?: string; options?: Array<{ value: string; label: string }> }
      | null;

    return NextResponse.json({
      subStep: phase.subStep,
      subStepArtifact: artifact,
      subStepChoice: phase.subStepChoice,
      options: artifact?.options ?? [],
    });
  } catch (error) {
    console.error("[GET /api/projects/[id]/phases/[phaseId]/substep/artifact]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
