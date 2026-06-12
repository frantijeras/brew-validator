import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { enqueuePhaseJob } from "@/lib/bridge/phase-jobs";
import { PHASE_SUBSTEPS } from "@/lib/phase-substeps";

/**
 * POST /api/projects/[id]/phases/[phaseId]/substep/choose
 *
 * El usuario eligió (A/B/C o nombre custom) en el modal de sub-step.
 * Crea un nuevo job en el bridge con:
 *  - subStep: nextSubStep (calculado desde PHASE_SUBSTEPS si se omite)
 *  - mode: "report"
 *  - answers: { subStepChoice: choice }
 *  - previousArtifacts: ya poblado por el helper con el subStepArtifact previo
 *
 * Status: SUBSTEP_READY → PROCESSING.
 *
 * Flujo IDENTITY: naming → voice → logo → visual → (fase completada).
 *
 * Body:
 *   { choice: string, nextSubStep?: "naming"|"voice"|"logo"|"visual" }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;
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

    // Sub-steps whose choice is a free identifier (mirrors FREE_INPUT_SUBSTEPS
    // in the modal): "naming" (custom name allowed), "logo" (chosen logo id of
    // 1..12) and "visual" (chosen variant A/B/C — options live inside the HTML
    // artifact, not as a top-level options array). For sub-steps that DO expose
    // a top-level options array, the choice must match one of them.
    const FREE_INPUT_SUBSTEPS = new Set(["naming", "logo", "visual"]);
    const currentSubStep = phase.subStep || "";
    if (!FREE_INPUT_SUBSTEPS.has(currentSubStep)) {
      const artifact = phase.subStepArtifact as {
        options?: Array<{ value?: unknown; label?: unknown }>;
      } | null;
      const opts = Array.isArray(artifact?.options) ? artifact.options : null;
      if (opts && opts.length > 0) {
        const isValid = opts.some(
          (o) => o?.value === choice || o?.label === choice
        );
        if (!isValid) {
          return NextResponse.json(
            { error: "La elección no corresponde a ninguna de las opciones generadas" },
            { status: 400 }
          );
        }
      }
    }

    // Accumulate the confirmed sub-step into `subStepHistory` so each sub-step
    // (naming / voice / logo / visual) is preserved independently. The singular
    // `subStepArtifact`/`subStepChoice` fields hold only the *current* sub-step
    // and get overwritten by the next one — the history is what the 3d composition
    // (maqueta + guía) and the hand-off read from to assemble the chosen options
    // of every sub-step. We merge (never overwrite the whole map).
    const prevHistory =
      phase.subStepHistory && typeof phase.subStepHistory === "object" && !Array.isArray(phase.subStepHistory)
        ? (phase.subStepHistory as Record<string, unknown>)
        : {};
    const subStepId = phase.subStep || "unknown";
    const subStepLabel =
      PHASE_SUBSTEPS[phase.type]?.find((s) => s.id === subStepId)?.label ?? subStepId;
    const historyEntry = {
      subStep: subStepId,
      label: subStepLabel,
      choice,
      artifact: phase.subStepArtifact ?? null,
      confirmedAt: new Date().toISOString(),
    };
    const nextHistory = {
      ...prevHistory,
      [subStepId]: historyEntry,
    } as Prisma.InputJsonValue;

    // Persist the user's choice on the phase BEFORE launching the next job,
    // so the webhook can read it and downstream agents receive it in
    // `previousArtifacts` (via the helper's `includePreviousSubStepArtifact`).
    await prisma.projectPhase.update({
      where: { id: phaseId },
      data: { subStepChoice: choice, subStepHistory: nextHistory },
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
        // No current sub-step yet: IDENTITY starts at "naming". Other phase
        // types no longer use this route (Roadmap = quiz → report único).
        nextSubStepName = phase.type === "IDENTITY" ? "naming" : undefined;
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
