import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveErrorType, getErrorMeta } from "@/lib/phase-errors";
import {
  writeBridgeLog,
  extractBridgeTelemetry,
  isEmptyOutput,
} from "@/lib/bridge-log";
import { verifyBridgeSecret } from "@/lib/bridge-auth";

/**
 * Sub-step artifact shape. The agent emits this JSON when a sub-step produces
 * an intermediate artifact (e.g. 3 mockup options, 3 naming rounds, 3
 * unit-economics scenarios). The bridge stores it in `subStepArtifact` and
 * puts the phase in `SUBSTEP_READY` so the UI can show it for user review.
 */
interface SubStepArtifact {
  type: "html" | "markdown";
  content: string;
  options?: Array<{ value: string; label: string }>;
}

/**
 * Sub-pasos intermedios por tipo de fase: nunca completan la fase de golpe,
 * pasan por SUBSTEP_READY para que el usuario revise/elija. Definidos una sola
 * vez aquí (antes estaban duplicados dentro del handler con nombres distintos).
 */
const IDENTITY_INTERMEDIATE_SUBSTEPS = ["naming", "voice", "visual"];
const EXECUTION_INTERMEDIATE_SUBSTEPS = ["plan_30_60_90"];
const ALL_INTERMEDIATE_SUBSTEPS = [
  ...IDENTITY_INTERMEDIATE_SUBSTEPS,
  ...EXECUTION_INTERMEDIATE_SUBSTEPS,
];

/**
 * POST /api/webhooks/project-phase-callback
 *
 * Bridge webhook que recibe el resultado de un job de ProjectPhase. Soporta:
 *  - mode "questions" (job 1 — quiz): guarda `questions` y pone la fase en QUESTIONING.
 *  - mode "report" + subStep final: guarda el output en `artifacts` y completa la fase.
 *  - mode "report" + subStep intermedio: guarda el output en `subStepArtifact` y
 *    pone la fase en SUBSTEP_READY para que el usuario revise y elija/iterate.
 */
export async function POST(req: Request) {
  try {
    if (!verifyBridgeSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { jobId, status, output, mode } = body;

    if (!jobId || !status) {
      return NextResponse.json({ error: "Missing jobId or status" }, { status: 400 });
    }

    // Find the job
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Idempotency: a terminal job must not be reprocessed. Two callbacks for
    // the same job (bridge retry / duplicate delivery) would otherwise double
    // -unlock phases or overwrite state. Ack and skip.
    if (job.status === "COMPLETED" || job.status === "FAILED") {
      return NextResponse.json({ ok: true, skipped: "job already terminal" });
    }

    // Find phase from job input — parse defensively: a corrupt string must not
    // throw an unhandled error (which would surface as a 500 and trigger bridge
    // retries).
    const rawInput = job.input;
    let jobInput: Record<string, unknown> = {};
    if (typeof rawInput === "string") {
      try {
        jobInput = JSON.parse(rawInput) as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { error: "Invalid job.input JSON" },
          { status: 400 }
        );
      }
    } else if (rawInput && typeof rawInput === "object") {
      jobInput = rawInput as Record<string, unknown>;
    }
    const projectId = jobInput.projectId as string | undefined;
    const phaseId = jobInput.phaseId as string | undefined;
    const subStep = jobInput.subStep as string | null | undefined;

    // Validate phase ownership ONCE: the phase referenced in job.input must
    // belong to the project in job.input. Prevents a crafted job from steering
    // a callback at another project's phase. Subsequent updates use the unique
    // phaseId, which is now known to belong to projectId.
    if (phaseId) {
      const owned = await prisma.projectPhase.findFirst({
        where: { id: phaseId, projectId },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { error: "Phase not found for this project" },
          { status: 404 }
        );
      }
    }

    // Telemetría estructurada que pueda mandar el bridge (httpStatus, model,
    // tokens, latencia, retryCount). Tolera ausencia (bridge antiguo → nulls).
    const telemetry = extractBridgeTelemetry(body);

    if (status === "COMPLETED" && !isEmptyOutput(output)) {
      // Parse output
      let parsedOutput: Record<string, unknown> = {};
      try {
        parsedOutput =
          typeof output === "string" ? JSON.parse(output) : output;
      } catch {
        parsedOutput = { reportMarkdown: String(output) };
      }

      const responseMode = mode || parsedOutput.mode || "report";

      if (responseMode === "questions" && phaseId) {
        // ── QUESTIONS MODE: store questions, mark phase as QUESTIONING ──
        const questions = parsedOutput.questions || [];
        if (Array.isArray(questions) && questions.length > 0) {
          await prisma.projectPhase.update({
            where: { id: phaseId },
            data: {
              status: "QUESTIONING",
              questions: questions,
              subStep: subStep || "quiz",
            },
          });
        } else {
          // No questions generated — fallback: complete phase
          await prisma.projectPhase.update({
            where: { id: phaseId },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
        }
      } else if (phaseId) {
        // ── REPORT MODE ──
        // Detect if this is a sub-step intermediate output (naming/mockup/compare/...)
        // or the final sub-step ("final"). The agent emits `subStep` in its output,
        // but the bridge can also infer it from the job input.
        const outputSubStepClaim = parsedOutput.subStep as string | undefined;
        // If the agent claims a different subStep than expected, trust the
        // job input (the expected one). This prevents agents from skipping
        // sub-steps (e.g. jumping from "naming" directly to "visual" without
        // going through "voice").
        const outputSubStep =
          outputSubStepClaim && subStep && outputSubStepClaim !== subStep
            ? subStep
            : (outputSubStepClaim ?? subStep ?? null);
        // Query phase early so phaseType is available for intermediate check
        const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
        const phaseType = phase?.type;
        const isIntermediate =
          (outputSubStep && outputSubStep !== "final") ||
          (phaseType === "EXECUTION" && EXECUTION_INTERMEDIATE_SUBSTEPS.includes(outputSubStep ?? ""));
        // The agent may emit the intermediate artifact as `subStepArtifact` OR as
        // `reportMarkdown`/`content` + `options`. We accept both shapes.
        const artifact: SubStepArtifact | null =
          (parsedOutput.subStepArtifact as SubStepArtifact | undefined) ??
          (parsedOutput.subStepArtifactJson as SubStepArtifact | undefined) ??
          (parsedOutput.content && (parsedOutput.options || (parsedOutput.type === "html"))
            ? {
                type: (parsedOutput.type as "html" | "markdown") || "markdown",
                content: String(parsedOutput.content),
                options: (parsedOutput.options as Array<{ value: string; label: string }> | undefined) ?? undefined,
              }
            : null);

        // Defensive heuristic: a naming/voice sub-step should NOT contain the
        // other sub-steps' sections. If it does, the agent likely emitted the
        // whole IDENTITY phase in one go (a known bug). We can't reliably split
        // a monolithic markdown here, so we log a loud warning — the real fix
        // is the agent prompt (see docs/bridge-prompts-fase3.md).
        if (
          phaseType === "IDENTITY" &&
          (outputSubStep === "naming" || outputSubStep === "voice") &&
          artifact?.content
        ) {
          const lc = artifact.content.toLowerCase();
          const foreignMarkers =
            outputSubStep === "naming"
              ? ["voz y tono", "tono de voz", "paleta de colores", "tipografía", "estilo visual"]
              : ["nombre elegido", "naming", "paleta de colores", "estilo visual"];
          const hit = foreignMarkers.find((m) => lc.includes(m));
          if (hit || artifact.content.length > 8000) {
            console.warn(
              `[project-phase-callback] IDENTITY sub-step "${outputSubStep}" (job ${jobId}) looks monolithic ` +
                `(len=${artifact.content.length}${hit ? `, contains "${hit}"` : ""}). ` +
                `The agent may be emitting multiple sub-steps at once — review the project-branding prompt.`
            );
          }
        }

        if (isIntermediate && artifact) {
          // ── INTERMEDIATE SUB-STEP ──
          // Persist the artifact in subStepArtifact + mark phase as SUBSTEP_READY.
          // We DON'T unlock the next phase — the user must review first.
          const artifactJson: Prisma.InputJsonValue = {
            type: artifact.type,
            content: artifact.content,
            ...(artifact.options
              ? { options: artifact.options as unknown as Prisma.InputJsonValue }
              : {}),
          };
          const data: Prisma.ProjectPhaseUpdateInput = {
            status: "SUBSTEP_READY",
            subStep: outputSubStep,
            subStepArtifact: artifactJson,
          };
          if (artifact.options && artifact.options.length > 0) {
            data.questions = artifact.options.map((o) => ({
              id: `substep_option_${o.value}`,
              label: o.label,
              type: "choice",
              options: [o],
            })) as unknown as Prisma.InputJsonValue;
          } else {
            data.questions = Prisma.JsonNull;
          }
          await prisma.projectPhase.update({
            where: { id: phaseId },
            data,
          });
        } else {
          // ── FINAL REPORT, SUBSTEP WITHOUT ARTIFACT FALLBACK, or unexpected shape ──
          // For IDENTITY phases with intermediate sub-steps, we must NEVER complete
          // the phase without going through all sub-steps (naming → voice → visual → final).
          if (
            (phaseType === "IDENTITY" || phaseType === "EXECUTION") &&
            ALL_INTERMEDIATE_SUBSTEPS.includes(outputSubStep ?? "")
          ) {
            // Intermediate IDENTITY sub-step but no proper artifact shape.
            // Try to build an artifact from available content before giving up.
            const fallbackContent =
              typeof parsedOutput.reportMarkdown === "string"
                ? parsedOutput.reportMarkdown
                : typeof parsedOutput.content === "string"
                  ? parsedOutput.content
                  : null;

            if (fallbackContent) {
              // We have content but no proper options — create a minimal artifact
              // so the user can at least see the generated content and type a custom choice.
              const fallbackArtifact: Prisma.InputJsonValue = {
                type: parsedOutput.type === "html" ? "html" : "markdown",
                content: fallbackContent,
              };
              await prisma.projectPhase.update({
                where: { id: phaseId },
                data: {
                  status: "SUBSTEP_READY",
                  subStep: outputSubStep,
                  subStepArtifact: fallbackArtifact,
                },
              });
            } else {
              // No content at all — mark error and reset to AVAILABLE so user can retry
              await prisma.projectPhase.update({
                where: { id: phaseId },
                data: {
                  status: "AVAILABLE",
                  lastError: {
                    message: `El agente no generó artefacto para el sub-paso "${outputSubStep}". Inténtalo de nuevo.`,
                    category: "agent_error",
                    timestamp: new Date().toISOString(),
                  },
                },
              });
            }
          } else {
            // ── Genuine final report (or non-IDENTITY phase) ──
            // Store in artifacts and complete the phase.
            const reportMarkdown =
              typeof parsedOutput.reportMarkdown === "string"
                ? parsedOutput.reportMarkdown
                : typeof parsedOutput.content === "string"
                  ? parsedOutput.content
                  : String(output);

            const extraFields: Record<string, string> = {};
            for (const [k, v] of Object.entries(parsedOutput)) {
              if (
                k !== "reportMarkdown" &&
                k !== "mode" &&
                k !== "subStep" &&
                k !== "subStepArtifact" &&
                k !== "subStepArtifactJson" &&
                k !== "type" &&
                k !== "content" &&
                k !== "options" &&
                typeof v === "string"
              ) {
                extraFields[k] = v;
              }
            }

            if (phase) {
              const artifactEntry = {
                title: phase.label,
                content: reportMarkdown,
                type: phase.type,
                ...extraFields,
              };

              // Complete this phase and unlock the next one atomically, so a
              // concurrent callback can't observe a half-applied transition.
              // Only unlock the next phase if it's still LOCKED (don't reopen a
              // phase a user already started elsewhere).
              await prisma.$transaction(async (tx) => {
                await tx.projectPhase.update({
                  where: { id: phaseId },
                  data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    subStep: outputSubStep,
                    artifacts: [artifactEntry],
                  },
                });

                await tx.projectPhase.updateMany({
                  where: {
                    projectId,
                    sortOrder: phase.sortOrder + 1,
                    status: "LOCKED",
                  },
                  data: { status: "AVAILABLE" },
                });
              });
            }
          }
        }
      }

      // Mark job as COMPLETED
      const cost = typeof body.cost === "number" ? body.cost : 0;
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          output: typeof parsedOutput === "string" ? parsedOutput : JSON.stringify(parsedOutput),
          cost,
          finishedAt: new Date(),
        },
      });
    } else if (status === "COMPLETED" || status === "FAILED") {
      // ── FALLO ──
      // Dos casos llegan aquí:
      //  - status === "FAILED": el bridge reporta un fallo explícito.
      //  - status === "COMPLETED" con output vacío: el modelo terminó pero no
      //    devolvió contenido utilizable ("empty_response" — no respondió).
      // En ambos: marcamos el job como FAILED, devolvemos la fase a AVAILABLE
      // con un lastError enriquecido y dejamos traza en BridgeLog.
      const isEmpty = status === "COMPLETED";
      const rawError = isEmpty
        ? "El modelo terminó sin devolver contenido (respuesta vacía)."
        : typeof body.error === "string" && body.error
          ? body.error
          : "Agent returned no output";

      // Prioriza el errorType del bridge; si es empty, fuerza empty_response.
      const errorType = isEmpty
        ? "empty_response"
        : resolveErrorType({ errorType: body.errorType, error: rawError });
      const meta = getErrorMeta(errorType);

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error: rawError,
          finishedAt: new Date(),
        },
      });

      // Si la fase estaba en un estado en curso, desbloquéala para reintentar.
      let resolutionAction = "logged";
      if (phaseId) {
        const phase = await prisma.projectPhase.findUnique({
          where: { id: phaseId },
        });
        if (
          phase &&
          (phase.status === "QUESTIONING" ||
            phase.status === "PROCESSING" ||
            phase.status === "SUBSTEP_READY")
        ) {
          await prisma.projectPhase.update({
            where: { id: phaseId },
            data: {
              status: "AVAILABLE",
              lastError: {
                message: meta.description,
                category: errorType,
                timestamp: new Date().toISOString(),
                // Detalle estructurado para el panel de historial / debugging.
                errorType,
                httpStatus: telemetry.httpStatus ?? undefined,
                model: telemetry.model ?? undefined,
                retryCount: telemetry.retryCount ?? undefined,
                rawMessage: rawError,
              },
            },
          });
          resolutionAction = "reset_to_available";
        }
      }

      await writeBridgeLog({
        level: "error",
        jobId,
        projectId: projectId ?? null,
        phaseId: phaseId ?? null,
        agentName: job.agentName,
        errorType,
        errorMessage: rawError,
        httpStatus: telemetry.httpStatus,
        retryCount: telemetry.retryCount,
        resolutionAction,
        model: telemetry.model,
        provider: telemetry.provider,
        tokensIn: telemetry.tokensIn,
        tokensOut: telemetry.tokensOut,
        latencyMs: telemetry.latencyMs,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/webhooks/project-phase-callback]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
