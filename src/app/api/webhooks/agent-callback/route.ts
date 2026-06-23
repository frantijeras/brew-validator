import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyBridgeSecret } from "@/lib/bridge-auth";
import { resolveErrorType } from "@/lib/phase-errors";
import {
  writeBridgeLog,
  extractBridgeTelemetry,
  isEmptyOutput,
} from "@/lib/bridge-log";
import { safeParsePhaseOutput, PHASE_SCHEMA_VERSION } from "@/lib/phase-schemas";
import { RESOLUTION_ACTION, isCritical } from "@/lib/bridge-retry";
import { dispatchCriticalAlert } from "@/lib/critical-alert";

const callbackSchema = z.object({
  jobId: z.string(),
  status: z.enum(["COMPLETED", "FAILED"]),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  cost: z.number().positive().optional(),
  // Campos estructurados que manda el bridge para diagnóstico (opcionales:
  // un bridge antiguo simplemente no los envía).
  errorType: z.string().optional(),
  httpStatus: z.number().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  tokensIn: z.number().optional(),
  tokensOut: z.number().optional(),
  latencyMs: z.number().optional(),
  retryCount: z.number().optional(),
});

const VALIDATION_AGENTS = ["skeptic", "advocate", "judge"];
const GENERATOR_AGENT = "idea-generator";

export async function POST(req: NextRequest) {
  try {
    if (!verifyBridgeSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const data = callbackSchema.parse(body);

    const job = await prisma.job.findUnique({ where: { id: data.jobId } });
    if (!job) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    // Idempotencia: si el job ya fue procesado, ignorar callback duplicado
    if (job.status === "COMPLETED") {
      return NextResponse.json({ success: true, skipped: true });
    }

    const isValidationAgent = VALIDATION_AGENTS.includes(job.agentName);
    const isGeneratorAgent = job.agentName === GENERATOR_AGENT;

    // Telemetría estructurada del bridge (httpStatus, model, tokens, ...).
    const telemetry = extractBridgeTelemetry(body as Record<string, unknown>);
    // Un COMPLETED con output vacío = el modelo no devolvió nada ("empty_response").
    // Se trata como fallo para no avanzar el flujo con datos vacíos.
    const emptyCompleted = data.status === "COMPLETED" && isEmptyOutput(data.output);

    if (data.status === "FAILED" || emptyCompleted) {
      const rawError = emptyCompleted
        ? "El modelo terminó sin devolver contenido (respuesta vacía)."
        : data.error || "Error desconocido";
      const errorType = emptyCompleted
        ? "empty_response"
        : resolveErrorType({ errorType: data.errorType, error: rawError });
      // Atomic claim: only the callback that flips the job out of a non-terminal
      // state proceeds. A concurrent duplicate gets count===0 and is skipped,
      // preventing double idea-state mutations.
      const claim = await prisma.job.updateMany({
        where: { id: data.jobId, status: { notIn: ["COMPLETED", "FAILED"] } },
        data: {
          status: "FAILED",
          error: rawError,
          finishedAt: new Date(),
          cost: data.cost || 0,
        },
      });
      if (claim.count === 0) {
        return NextResponse.json({ success: true, skipped: true });
      }

      // Acción base: para agentes de validación/generación, el fallo marca la
      // idea como FAILED (ver más abajo), así que registramos esa acción real
      // ("idea_marked_failed"); en los demás agentes, solo se registra.
      let resolutionAction: string =
        isValidationAgent || isGeneratorAgent
          ? "idea_marked_failed"
          : RESOLUTION_ACTION.LOGGED;
      // En respuesta vacía señalamos reintento simplificado.
      if (emptyCompleted) {
        resolutionAction = RESOLUTION_ACTION.SIMPLIFIED_RETRY;
      }

      // ── ALERTA CRÍTICA (Capa 4) ──
      // Si el job agotó los reintentos, notificamos (best-effort). Los jobs de
      // ideas no tienen projectId, así que la notificación in-app no se crea,
      // pero el webhook externo (si está configurado) sí recibe el contexto.
      if (isCritical(telemetry.retryCount)) {
        try {
          await dispatchCriticalAlert({
            agentName: job.agentName,
            errorType,
            rawMessage: rawError,
            retryCount: telemetry.retryCount,
            model: telemetry.model,
          });
        } catch (e) {
          console.error("[agent-callback] alerta crítica falló", e);
        }
        resolutionAction = `${resolutionAction}+${RESOLUTION_ACTION.ALERTED}`;
      }

      // Traza del fallo en BridgeLog (best-effort).
      await writeBridgeLog({
        level: "error",
        jobId: data.jobId,
        ideaId: job.ideaId,
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
        schemaVersion: PHASE_SCHEMA_VERSION,
      });

      // If any validation agent fails, mark idea as FAILED so the
      // user sees the error and can retry. Reset status to COMPLETED
      // so the idea isn't stuck in VALIDATING (which blocks retry).
      if (isValidationAgent) {
        await prisma.idea.update({
          where: { id: job.ideaId },
          data: {
            validationStatus: "FAILED",
            status: "COMPLETED",
          },
        });
      }

      // If idea-generator fails, mark idea as FAILED
      if (isGeneratorAgent) {
        await prisma.idea.update({
          where: { id: job.ideaId },
          data: { status: "FAILED", validationStatus: "FAILED" },
        });
      }

      return NextResponse.json({ success: true });
    }

    // ── COMPLETED ──
    const output = data.output || {};
    const cost = data.cost || 0.02;

    // Atomic claim (same pattern as FAILED): guarantees exactly one callback
    // proceeds past this point for a given job, so reports aren't created
    // twice when duplicate callbacks race.
    const claim = await prisma.job.updateMany({
      where: { id: data.jobId, status: { notIn: ["COMPLETED", "FAILED"] } },
      data: {
        status: "COMPLETED",
        output: JSON.stringify(output),
        finishedAt: new Date(),
        cost,
      },
    });
    if (claim.count === 0) {
      return NextResponse.json({ success: true, skipped: true });
    }

    // ── Idea Generator callback ──
    if (isGeneratorAgent) {
      const title = (output.title as string) || "";
      const description = (output.description as string) || "";
      const problem = (output.problem as string) || "";
      const valueProposition = (output.valueProposition as string) || "";
      const targetUser = (output.targetUser as string) || "";
      const monetization = (output.monetization as string) || "";

      if (title && description) {
        // Read the current idea to preserve originalIdea (user's raw input)
        // before the AI description overwrites it.
        const currentIdea = await prisma.idea.findUnique({
          where: { id: job.ideaId },
          select: { originalIdea: true, description: true },
        });
        const preservedOriginal = currentIdea?.originalIdea ?? currentIdea?.description ?? null;

        await prisma.idea.update({
          where: { id: job.ideaId },
          data: {
            title,
            description,
            problem: problem || null,
            valueProposition: valueProposition || null,
            targetUser: targetUser || "Por determinar",
            monetization: monetization || "Por determinar",
            originalIdea: preservedOriginal, // ← preserve user's raw input
            status: "DRAFT",
            validationStatus: "PENDING",
          },
        });

        // NO V0 creation — V0 is virtual.
        // First real version (V1) is created only after first successful validation.
      } else {
        await prisma.idea.update({
          where: { id: job.ideaId },
          data: {
            status: "FAILED",
            validationStatus: "FAILED",
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    // ── Validation agent callback (skeptic / advocate / judge) ──

    // Validación estructurada (Salidas estructuradas): el output de un agente
    // de validación es un informe (reportMarkdown). Validamos la envoltura con
    // Zod de forma NO bloqueante — el flujo actual ya tolera formas alternativas
    // (cae a JSON.stringify), así que aquí solo registramos en BridgeLog si el
    // esquema se rompe, para tener trazabilidad sin alterar el comportamiento.
    const reportValidation = safeParsePhaseOutput("report", output);
    if (!reportValidation.success) {
      await writeBridgeLog({
        level: "warning",
        jobId: data.jobId,
        ideaId: job.ideaId,
        agentName: job.agentName,
        errorType: "invalid_response",
        errorMessage: reportValidation.errors.join("; "),
        httpStatus: telemetry.httpStatus,
        retryCount: telemetry.retryCount,
        // No bloqueamos: el flujo recupera el contenido de forma defensiva.
        resolutionAction: RESOLUTION_ACTION.AUTOCORRECTED,
        model: telemetry.model,
        provider: telemetry.provider,
        tokensIn: telemetry.tokensIn,
        tokensOut: telemetry.tokensOut,
        latencyMs: telemetry.latencyMs,
        schemaVersion: PHASE_SCHEMA_VERSION,
      });
    }

    // Create or update report
    const reportContent = (output.reportMarkdown as string) || JSON.stringify(output);
    const verdict = (output.verdict as string) || "";
    const scorecard = (output.scorecard as string) || "";
    const rawScore = output.score;
    const judgeScore: number | null =
      typeof rawScore === "number" && !isNaN(rawScore) && rawScore >= 0 && rawScore <= 10
        ? parseFloat(rawScore.toFixed(1))
        : null;

    const existingReport = await prisma.report.findFirst({
      where: { ideaId: job.ideaId, agentName: job.agentName },
    });

    if (existingReport) {
      await prisma.report.update({
        where: { id: existingReport.id },
        data: {
          content: reportContent,
          ...(verdict ? { verdict } : {}),
          ...(scorecard ? { scorecard } : {}),
          ...(judgeScore !== null ? { score: judgeScore } : {}),
        },
      });
    } else {
      await prisma.report.create({
        data: {
          ideaId: job.ideaId,
          agentName: job.agentName,
          title: `${job.agentName} — Report`,
          content: reportContent,
          ...(verdict ? { verdict } : {}),
          ...(scorecard ? { scorecard } : {}),
          ...(judgeScore !== null ? { score: judgeScore } : {}),
        },
      });
    }

    // ── IDEA FINALIZATION: ONLY when all 3 agents are DONE ──
    // Advisory lock prevents duplicate finalization when callbacks arrive
    // simultaneously (race condition). The lock key is the ideaId as a bigint.
    await prisma.$transaction(async (tx) => {
      // Acquire an advisory lock scoped to this idea + transaction
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(abs(hashtext(${job.ideaId})))`;

      const pendingJobs = await tx.job.count({
        where: {
          ideaId: job.ideaId,
          agentName: { in: ["skeptic", "advocate", "judge"] },
          status: { in: ["PENDING", "RUNNING"] },
        },
      });

      if (pendingJobs !== 0) return;

      // All 3 validation agents completed
      const allReports = await tx.report.findMany({
        where: { ideaId: job.ideaId },
      });

      // Compute judge verdict and score from reports
      const judgeReport = allReports.find(r => r.agentName === "judge");

      const updateData: Record<string, unknown> = {
        validationStatus: "DONE",
        status: "COMPLETED",
      };

      if (judgeReport) {
        if (judgeReport.verdict) updateData.verdict = judgeReport.verdict;

        // New contract: judgeReport.score is a number with 1 decimal (0.0-10.0).
        // Legacy: judgeReport.scorecard is a JSON string with [{key,value,description},...].
        // We prefer `score`; if it's missing/invalid, fall back to legacy scorecard parsing.
        let resolvedScore: number | null = null;
        if (judgeReport.score !== null && judgeReport.score !== undefined) {
          const s = Number(judgeReport.score);
          if (!isNaN(s) && s >= 0 && s <= 10) {
            resolvedScore = s;
          }
        }
        if (resolvedScore === null && judgeReport.scorecard) {
          try {
            const sc = JSON.parse(judgeReport.scorecard);
            if (typeof sc === "object" && sc !== null && !Array.isArray(sc)) {
              // Flat object format: {"Problema": 6.0, ..., "Total": 4.5}
              // Preferred: read "Total" directly. Fallback: average numeric values.
              const obj = sc as Record<string, unknown>;
              let legacy: number | null =
                (typeof obj.Total === "number" ? obj.Total : null) ??
                (typeof obj.total === "number" ? obj.total : null) ??
                (typeof obj.puntuacion === "number" ? obj.puntuacion : null);
              if (legacy === null) {
                const numericValues = Object.values(obj)
                  .map((v) => Number(v))
                  .filter((v) => !isNaN(v) && v >= 0 && v <= 10);
                if (numericValues.length > 0) {
                  legacy = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
                }
              }
              if (legacy !== null && !isNaN(legacy)) {
                resolvedScore = legacy;
              }
            } else if (Array.isArray(sc)) {
              // New judge v4 format: [{ k, v, d }, ...] — read v from item with k === "Total"
              const newFormatTotal = sc.find(
                (it: unknown) =>
                  typeof it === "object" &&
                  it !== null &&
                  ((it as Record<string, unknown>).k === "Total" ||
                    (it as Record<string, unknown>).k === "total" ||
                    (it as Record<string, unknown>).k === "puntuación")
              );
              if (newFormatTotal) {
                const v = Number((newFormatTotal as Record<string, unknown>).v);
                if (!isNaN(v) && v >= 0 && v <= 10) {
                  resolvedScore = v;
                }
              }
              // Legacy array format: [{ key, value, description }, ...]
              if (resolvedScore === null) {
                const totalItem = sc.find(
                  (it: unknown) =>
                    typeof it === "object" &&
                    it !== null &&
                    ((it as Record<string, unknown>).key === "Total" ||
                      (it as Record<string, unknown>).key === "total" ||
                      (it as Record<string, unknown>).key === "puntuación")
                );
                if (totalItem) {
                  resolvedScore = Number((totalItem as Record<string, unknown>).value);
                }
              }
              // No Total row — average the 8 dimension values (works for both formats)
              if (resolvedScore === null) {
                const numericValues = sc
                  .map((it: unknown) => {
                    if (typeof it !== "object" || it === null) return NaN;
                    const obj = it as Record<string, unknown>;
                    // New format: v; legacy: value
                    const val = obj.v !== undefined ? obj.v : obj.value;
                    return Number(val);
                  })
                  .filter((v: number) => !isNaN(v) && v >= 0 && v <= 10);
                if (numericValues.length > 0) {
                  resolvedScore =
                    numericValues.reduce((s: number, v: number) => s + v, 0) / numericValues.length;
                }
              }
            }
          } catch {
            // ignore parse error
          }
        }

        if (resolvedScore !== null && !isNaN(resolvedScore)) {
          updateData.score = parseFloat(Number(resolvedScore).toFixed(1));
        }
      }

      // (Retirado) El juez ya NO renombra la idea con suggestedName: el título
      // lo fija el idea-generator. Renombrar desde el juez pisaba el nombre
      // elegido y no es competencia del juez.

      // Update the idea
      await tx.idea.update({
        where: { id: job.ideaId },
        data: updateData,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Payload inválido", details: error.issues },
        { status: 400 }
      );
    }

    console.error("[POST /api/webhooks/agent-callback]", error);
    return NextResponse.json(
      { error: "Error al procesar el callback del agente" },
      { status: 500 }
    );
  }
}
