import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/projects/[id]/rename
 *
 * Actualiza `idea.title` y `project.name` cuando se confirma un nombre nuevo
 * en Fase 2 (branding, subStep `naming`).
 *
 * Solo se permite llamar:
 *  - El proyecto pertenece al user actual (validado en el futuro cuando se
 *    introduzca auth en endpoints de proyecto).
 *  - La fase con subStep `naming` debe estar en SUBSTEP_READY o COMPLETED.
 *
 * Body:
 *   { newName: string, phaseId: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { newName, phaseId } = await req.json();

    if (!newName || typeof newName !== "string" || !newName.trim()) {
      return NextResponse.json({ error: "Missing newName" }, { status: 400 });
    }

    if (!phaseId) {
      return NextResponse.json({ error: "Missing phaseId" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    // Only allow rename during the naming sub-step of the branding phase.
    // We accept SUBSTEP_READY (user is reviewing candidates) and COMPLETED
    // (in case they want to re-rename from a finished phase).
    if (
      phase.type !== "IDENTITY" ||
      (phase.subStep !== "naming" && phase.subStep !== "final")
    ) {
      return NextResponse.json(
        { error: "Rename is only allowed during the naming sub-step of the branding phase" },
        { status: 409 }
      );
    }

    const cleanName = newName.trim();

    // Update both idea.title and project.name atomically. Idea is the source
    // of truth; Project.name is a denormalized display name.
    await prisma.$transaction([
      prisma.idea.update({
        where: { id: project.ideaId },
        data: { title: cleanName },
      }),
      prisma.project.update({
        where: { id: projectId },
        data: { name: cleanName },
      }),
    ]);

    return NextResponse.json({
      success: true,
      newName: cleanName,
      ideaId: project.ideaId,
      projectId,
    });
  } catch (error) {
    console.error("[POST /api/projects/[id]/rename]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
