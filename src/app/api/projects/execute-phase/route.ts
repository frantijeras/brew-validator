import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueuePhaseJob } from "@/lib/bridge/phase-jobs";
import { guardProject } from "@/lib/ownership";
import { getBridgeHealth, BRIDGE_OFFLINE_MESSAGE } from "@/lib/bridge/health";

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

    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    // Cruzar phaseId ↔ projectId: el guard valida el proyecto, pero la fase debe
    // pertenecer a ESE proyecto (evita operar sobre una fase de otro tenant).
    const phase = await prisma.projectPhase.findFirst({ where: { id: phaseId, projectId } });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    // Respuestas del quiz YA persistidas (de un envío anterior). Si la fase
    // falló DESPUÉS de responder el quiz, las recuperamos para reintentar SOLO
    // el informe sin re-preguntar (bug: antes el reintento regeneraba el quiz).
    const storedAnswers =
      phase.answers &&
      typeof phase.answers === "object" &&
      !Array.isArray(phase.answers)
        ? (phase.answers as Record<string, string>)
        : null;
    const hasStoredAnswers =
      !!storedAnswers && Object.keys(storedAnswers).length > 0;

    // Validate phase status based on mode — explicit whitelist per mode.
    // IDENTITY sub-steps use "report" mode from AVAILABLE state (they generate
    // intermediate artifacts, not quiz questions). Other phases use "questions" mode.
    // Un informe se permite también desde AVAILABLE cuando hay respuestas
    // persistidas: ése es el caso de "reintentar el informe que falló".
    const isIdentityPhase = phaseType === "IDENTITY";
    const allowedStatuses =
      mode === "questions"
        ? ["AVAILABLE"]
        : mode === "report"
          ? [
              "QUESTIONING",
              "SUBSTEP_READY",
              ...(isIdentityPhase || hasStoredAnswers ? ["AVAILABLE"] : []),
            ]
          : null;
    if (!allowedStatuses) {
      return NextResponse.json({ error: `Modo desconocido: ${mode}` }, { status: 400 });
    }
    if (!allowedStatuses.includes(phase.status)) {
      return NextResponse.json(
        {
          error: `La fase está en estado ${phase.status}; el modo "${mode}" requiere ${allowedStatuses.join(" o ")}`,
        },
        { status: 409 }
      );
    }

    // Respuestas efectivas: las del request (nuevo envío del quiz) o, si no
    // vienen, las ya persistidas (reintento de informe tras fallo).
    const requestAnswers =
      answers && typeof answers === "object" && Object.keys(answers).length > 0
        ? (answers as Record<string, string>)
        : null;
    const effectiveAnswers = requestAnswers ?? storedAnswers ?? undefined;

    // Quiz answers are mandatory when answering a questionnaire. Sub-step
    // launches (SUBSTEP_READY / IDENTITY from AVAILABLE) legitimately carry none.
    if (
      mode === "report" &&
      (phase.status === "QUESTIONING" ||
        (phase.status === "AVAILABLE" && !isIdentityPhase)) &&
      (!effectiveAnswers || Object.keys(effectiveAnswers).length === 0)
    ) {
      return NextResponse.json(
        { error: "Faltan las respuestas del cuestionario" },
        { status: 400 }
      );
    }

    // FAIL-FAST: si el bridge no está vivo, no encolamos (evita dejar la fase
    // colgada en PROCESSING esperando un callback que no llegará).
    if (process.env.BRIDGE_FAILFAST !== "off") {
      const health = await getBridgeHealth();
      if (!health.reachable) {
        return NextResponse.json(
          { error: BRIDGE_OFFLINE_MESSAGE, reason: health.reason },
          { status: 503 }
        );
      }
    }

    // Clear any previous error before starting a new execution. Si arrancamos
    // un informe con respuestas, las PERSISTIMOS en la fase para que un fallo
    // posterior pueda reintentar este mismo paso sin volver a preguntar.
    await prisma.projectPhase.update({
      where: { id: phaseId },
      data: {
        lastError: Prisma.JsonNull,
        ...(mode === "report" && effectiveAnswers
          ? { answers: effectiveAnswers as unknown as Prisma.InputJsonValue }
          : {}),
      },
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
      answers: effectiveAnswers,
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
