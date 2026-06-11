import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

    // Sub-steps that accept free text (mirrors FREE_INPUT_SUBSTEPS in the
    // modal). For option-only sub-steps (voice, visual, ...), the choice must
    // match one of the generated options — the UI sends either the option's
    // value or its label depending on the flow, so accept both.
    const FREE_INPUT_SUBSTEPS = new Set(["naming", "mockup", "final"]);
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
    // (naming / voice / visual) is preserved independently. The singular
    // `subStepArtifact`/`subStepChoice` fields hold only the *current* sub-step
    // and get overwritten by the next one — the history is what the Brand Book
    // and hand-off read from to consolidate the chosen options of every
    // sub-step. We merge (never overwrite the whole map).
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
