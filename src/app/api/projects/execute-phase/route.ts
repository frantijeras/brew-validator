import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueuePhaseJob } from "@/lib/bridge/phase-jobs";

/**
 * POST /api/projects/execute-phase
 *
 * Bridge principal para lanzar jobs de una fase de proyecto. Soporta:
 *  - mode "questions": arranca el job 1 (quiz) y deja la fase en PROCESSING.
 *    El webhook de callback lo pasará a QUESTIONING con las preguntas.
 *  - mode "report": se envía con `answers` para fases en QUESTIONING (siguiente
 *    job tras el quiz) o SUBSTEP_READY (iteración o sub-paso ya elegido).
 *  - `subStep` opcional: indica al agente en qué sub-paso del flujo multi-step
 *    estamos. Valores: "quiz" | "naming" | "mockup" | "compare" | "simulate" |
 *    "pilars" | "final". Si no se pasa, el agente infiere que es un sub-paso
 *    intermedio genérico (legacy).
 */
export async function POST(req: Request) {
  try {
    const {
      projectId,
      phaseId,
      phaseType,
      mode = "questions",
      answers,
      subStep,
      modelOverride,
    } = await req.json();
    if (!projectId || !phaseId || !phaseType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    // Validate phase status based on mode
    // IDENTITY sub-steps use "report" mode from AVAILABLE state (they generate
    // intermediate artifacts, not quiz questions). Other phases use "questions" mode.
    // Also allow mode "report" from QUESTIONING status (e.g., when restarting a sub-step).
    const isIdentityPhase = phaseType === "IDENTITY";
    if (mode === "questions" && phase.status !== "AVAILABLE") {
      return NextResponse.json({ error: "Phase is not available for questions" }, { status: 409 });
    }
    if (
      mode === "report" &&
      phase.status !== "QUESTIONING" &&
      phase.status !== "SUBSTEP_READY" &&
      !(isIdentityPhase && phase.status === "AVAILABLE")
    ) {
      return NextResponse.json(
        { error: "Phase must be in QUESTIONING or SUBSTEP_READY state to submit answers" },
        { status: 409 }
      );
    }

    // Clear any previous error before starting a new execution
    await prisma.projectPhase.update({
      where: { id: phaseId },
      data: { lastError: Prisma.JsonNull },
    });

    // Resolve the sub-step to run. For IDENTITY we must NOT default to "quiz"
    // (an invalid IDENTITY sub-step): passing null lets enqueuePhaseJob
    // auto-advance from the current position (null → "naming" on a fresh start,
    // or re-run the failed sub-step held in phase.subStep on a retry).
    const resolvedSubStep =
      subStep ?? phase.subStep ?? (phaseType === "IDENTITY" ? null : "quiz");

    const result = await enqueuePhaseJob({
      projectId,
      phaseId,
      phaseType,
      mode,
      subStep: resolvedSubStep,
      answers,
      modelOverride,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      subStep: result.subStep,
      message: result.message,
    });
  } catch (error) {
    console.error("Error executing phase:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
