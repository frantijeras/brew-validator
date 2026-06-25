import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { getUserAccess } from "@/lib/quota";
import { enqueuePhaseJob } from "@/lib/bridge/phase-jobs";

/**
 * POST /api/projects/[id]/phases/[phaseId]/substep/iterate
 *
 * El usuario pidió iterar el sub-paso actual con feedback libre.
 * Crea un nuevo job del MISMO subStep con `mode: "report"` y
 * `answers: { previousChoice, feedback }`. Status: SUBSTEP_READY → PROCESSING.
 * Cuando termine, el callback actualizará `subStepArtifact` con la nueva versión.
 *
 * Body:
 *   { feedback: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    // Iterar consume llamadas extra al Bridge: bloqueado en modo demo (no-admin).
    if (guard.userId) {
      const access = await getUserAccess(guard.userId);
      if (!access.isAdmin) {
        return NextResponse.json(
          { error: "La iteración no está disponible en el modo demo. Pídela al administrador." },
          { status: 403 }
        );
      }
    }

    const { feedback } = await req.json();

    if (!feedback || typeof feedback !== "string" || !feedback.trim()) {
      return NextResponse.json({ error: "Missing feedback" }, { status: 400 });
    }

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }
    if (phase.status !== "SUBSTEP_READY") {
      return NextResponse.json(
        { error: "Phase is not in SUBSTEP_READY state" },
        { status: 409 }
      );
    }

    const result = await enqueuePhaseJob({
      projectId,
      phaseId,
      phaseType: phase.type,
      mode: "report",
      subStep: phase.subStep, // Same subStep as before
      answers: {
        previousChoice: phase.subStepChoice || "",
        feedback: feedback.trim(),
        iterate: "true",
      },
      includePreviousSubStepArtifact: true,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      subStep: result.subStep,
    });
  } catch (error) {
    console.error(
      "[POST /api/projects/[id]/phases/[phaseId]/substep/iterate]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
