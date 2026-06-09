import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueuePhaseJob } from "@/lib/bridge/phase-jobs";
import { PHASE_SUBSTEPS } from "@/lib/phase-substeps";

/**
 * POST /api/projects/[id]/phases/[phaseId]/substep/choose
 *
 * El usuario eligió (A/B/C o nombre custom) en el modal de sub-step.
 * Crea un nuevo job en el bridge con:
 *  - subStep: nextSubStep (o "final" si se omite)
 *  - mode: "report"
 *  - answers: { subStepChoice: choice }
 *  - previousArtifacts: ya poblado por el helper con el subStepArtifact previo
 *
 * Status: SUBSTEP_READY → PROCESSING.
 *
 * Body:
 *   { choice: string, nextSubStep?: "naming"|"mockup"|"final"|... }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;
    const { choice, nextSubStep } = await req.json();

    if (!choice || typeof choice !== "string") {
      return NextResponse.json({ error: "Missing choice" }, { status: 400 });
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

    // Persist the user's choice on the phase BEFORE launching the next job,
    // so the webhook can read it and downstream agents receive it in
    // `previousArtifacts` (via the helper's `includePreviousSubStepArtifact`).
    await prisma.projectPhase.update({
      where: { id: phaseId },
      data: { subStepChoice: choice },
    });

    // Determine the next sub-step based on current position in PHASE_SUBSTEPS
    let nextSubStepName = nextSubStep;
    if (!nextSubStepName) {
      const substeps = PHASE_SUBSTEPS[phase.type];
      if (substeps && phase.subStep) {
        const currentIdx = substeps.findIndex((s) => s.id === phase.subStep);
        if (currentIdx >= 0 && currentIdx < substeps.length - 1) {
          nextSubStepName = substeps[currentIdx + 1].id;
        }
        // If currentIdx is the last one, nextSubStepName stays undefined → phase completes
      } else {
        nextSubStepName = phase.type === "IDENTITY" ? "naming" : "final";
      }
    }

    const result = await enqueuePhaseJob({
      projectId,
      phaseId,
      phaseType: phase.type,
      mode: "report",
      subStep: nextSubStepName,
      answers: { subStepChoice: choice },
      includePreviousSubStepArtifact: true,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      subStep: result.subStep,
      choice,
    });
  } catch (error) {
    console.error(
      "[POST /api/projects/[id]/phases/[phaseId]/substep/choose]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
