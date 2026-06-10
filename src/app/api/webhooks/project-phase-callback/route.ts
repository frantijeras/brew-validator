import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { classifyError } from "@/lib/phase-errors";

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

    // Find phase from job input
    const rawInput = job.input;
    const jobInput =
      typeof rawInput === "string"
        ? JSON.parse(rawInput)
        : rawInput && typeof rawInput === "object"
          ? (rawInput as Record<string, unknown>)
          : {};
    const projectId = (jobInput as any)?.projectId;
    const phaseId = (jobInput as any)?.phaseId;
    const subStep = (jobInput as any)?.subStep as string | null | undefined;

    if (status === "COMPLETED" && output) {
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
        const EXECUTION_INTERMEDIATE_SUBSTEPS = ["plan_30_60_90"];
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
          const IDENTITY_INTERMEDIATE_SUBSTEPS = ["naming", "voice", "visual"];
          const EXECUTION_INTERMEDIATE_SUBSTEPS_FALLBACK = ["plan_30_60_90"];
          const allIntermediateSubsteps = [...IDENTITY_INTERMEDIATE_SUBSTEPS, ...EXECUTION_INTERMEDIATE_SUBSTEPS_FALLBACK];

          if (
            (phaseType === "IDENTITY" || phaseType === "EXECUTION") &&
            allIntermediateSubsteps.includes(outputSubStep ?? "")
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

              await prisma.projectPhase.update({
                where: { id: phaseId },
                data: {
                  status: "COMPLETED",
                  completedAt: new Date(),
                  subStep: outputSubStep,
                  artifacts: [artifactEntry],
                },
              });

              // Unlock the next phase
              const nextPhase = await prisma.projectPhase.findFirst({
                where: { projectId, sortOrder: phase.sortOrder + 1 },
              });
              if (nextPhase) {
                await prisma.projectPhase.update({
                  where: { id: nextPhase.id },
                  data: { status: "AVAILABLE" },
                });
              }
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
    } else if (status === "FAILED") {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error: typeof body.error === "string" ? body.error : "Unknown error",
          finishedAt: new Date(),
        },
      });

      // If phase was in a question/processing/substep state, unlock it so user can retry
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
          const errorMessage = typeof body.error === "string" ? body.error : "Agent returned no output";
          await prisma.projectPhase.update({
            where: { id: phaseId },
            data: {
              status: "AVAILABLE",
              lastError: {
                message: errorMessage,
                category: classifyError(errorMessage),
                timestamp: new Date().toISOString(),
              },
            },
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/webhooks/project-phase-callback]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
