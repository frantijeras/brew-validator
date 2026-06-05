import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getNextVersionPhase } from "@/lib/versions";

const callbackSchema = z.object({
  jobId: z.string(),
  status: z.enum(["COMPLETED", "FAILED"]),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  cost: z.number().positive().optional(),
});

const VALIDATION_AGENTS = ["skeptic", "advocate", "judge"];
const GENERATOR_AGENT = "idea-generator";
const REFINER_AGENT = "brew-qa-refiner";
const RENAMER_AGENT = "idea-renamer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = callbackSchema.parse(body);

    const job = await prisma.job.findUnique({ where: { id: data.jobId } });
    if (!job) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    const isValidationAgent = VALIDATION_AGENTS.includes(job.agentName);
    const isGeneratorAgent = job.agentName === GENERATOR_AGENT;
    const isRefinerAgent = job.agentName === REFINER_AGENT;
    const isRenamerAgent = job.agentName === RENAMER_AGENT;

    if (data.status === "FAILED") {
      await prisma.job.update({
        where: { id: data.jobId },
        data: {
          status: "FAILED",
          error: data.error || "Error desconocido",
          finishedAt: new Date(),
          cost: data.cost || 0,
        },
      });

      // If judge fails too, mark idea as FAILED
      if (job.agentName === "judge") {
        await prisma.idea.update({
          where: { id: job.ideaId },
          data: { validationStatus: "FAILED" },
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

    await prisma.job.update({
      where: { id: data.jobId },
      data: {
        status: "COMPLETED",
        output: JSON.stringify(output),
        finishedAt: new Date(),
        cost,
      },
    });

    // ── Idea Generator callback ──
    if (isGeneratorAgent) {
      const title = (output.title as string) || "";
      const description = (output.description as string) || "";
      const problem = (output.problem as string) || "";
      const valueProposition = (output.valueProposition as string) || "";
      const targetUser = (output.targetUser as string) || "";
      const monetization = (output.monetization as string) || "";

      if (title && description) {
        await prisma.idea.update({
          where: { id: job.ideaId },
          data: {
            title,
            description,
            problem: problem || null,
            valueProposition: valueProposition || null,
            targetUser: targetUser || "Por determinar",
            monetization: monetization || "Por determinar",
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

    // ── QA Refiner callback ──
    if (isRefinerAgent) {
      const agentStatus = (output.status as string) || "";

      if (agentStatus === "DONE") {
        // Refiner output is a PROPOSAL. The user reviews it in the
        // wizard and decides whether to apply it. The refiner must
        // never mutate the Idea fields directly — that is the job of
        // POST /api/ideas/:id/refine/apply, called by the user.
        // We just acknowledge the callback; the frontend reads the
        // result from GET /api/ideas/:id/refine?jobId=... on next poll.
      }

      return NextResponse.json({ success: true });
    }

    // ── Idea Renamer callback ──
    if (isRenamerAgent) {
      return NextResponse.json({ success: true });
    }

    // ── Validation agent callback (skeptic / advocate / judge) ──

    // Create or update report
    const reportContent = (output.reportMarkdown as string) || JSON.stringify(output);
    const verdict = (output.verdict as string) || "";
    const scorecard = (output.scorecard as string) || "";

    // Look up the idea's currentVersionId so the report is anchored to
    // the version under validation. If the idea has no current version
    // yet (brand-new idea, first validation), ideaVersionId is left null
    // and gets set when the IdeaVersion is created below.
    const ideaForReport = await prisma.idea.findUnique({
      where: { id: job.ideaId },
      select: { currentVersionId: true },
    });

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
          // Backfill version link on legacy reports (null → current)
          ...(existingReport.ideaVersionId === null && ideaForReport?.currentVersionId
            ? { ideaVersionId: ideaForReport.currentVersionId }
            : {}),
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
          ...(ideaForReport?.currentVersionId
            ? { ideaVersionId: ideaForReport.currentVersionId }
            : {}),
        },
      });
    }

    // ── VERSION CREATION: ONLY when all 3 agents are DONE ──
    // Advisory lock prevents duplicate version creation when callbacks arrive
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

      // Get current idea state for snapshot
      const currentIdea = await tx.idea.findUnique({
        where: { id: job.ideaId },
        select: {
          title: true, description: true, problem: true, valueProposition: true,
          targetUser: true, monetization: true, score: true, verdict: true,
        },
      });

      // Compute judge verdict and score from reports
      const judgeReport = allReports.find(r => r.agentName === "judge");
      const judgeJob = await tx.job.findFirst({
        where: { ideaId: job.ideaId, agentName: "judge", status: "COMPLETED" },
        select: { output: true },
      });

      const updateData: Record<string, unknown> = {
        validationStatus: "DONE",
        status: "COMPLETED",
      };

      if (judgeReport) {
        if (judgeReport.verdict) updateData.verdict = judgeReport.verdict;

        if (judgeReport.scorecard) {
          try {
            const sc = JSON.parse(judgeReport.scorecard);
            let score: number | null = sc.Total || sc.total || sc.puntuacion || null;
            if (score === null) {
              const numericValues = Object.values(sc as Record<string, unknown>)
                .map(Number)
                .filter((v) => !isNaN(v) && v >= 0 && v <= 10);
              if (numericValues.length > 0) {
                score = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
              }
            }
            if (score !== null) updateData.score = parseFloat(Number(score).toFixed(1));
          } catch {
            // ignore parse error
          }
        }
      }

      // Try to get suggestedName from judge job output
      if (judgeJob?.output) {
        try {
          const parsed = JSON.parse(
            typeof judgeJob.output === "string"
              ? judgeJob.output
              : JSON.stringify(judgeJob.output)
          );
          if (parsed.suggestedName) updateData.title = parsed.suggestedName;
        } catch {
          // ignore
        }
      }

      // Update the idea
      await tx.idea.update({
        where: { id: job.ideaId },
        data: updateData,
      });

      // ── Create version snapshot ──
      const versionPhase = await getNextVersionPhase(job.ideaId, tx);

      if (currentIdea) {
        // Re-read the idea to get updated score/verdict
        const updatedIdea = await tx.idea.findUnique({
          where: { id: job.ideaId },
          select: {
            title: true, description: true, problem: true, valueProposition: true,
            targetUser: true, monetization: true, score: true, verdict: true,
          },
        });

        if (updatedIdea) {
          const reportsForSnapshot = allReports.map((r) => ({
            agentName: r.agentName,
            title: r.title,
            content: r.content,
            verdict: r.verdict,
            scorecard: r.scorecard,
            createdAt: r.createdAt,
          }));

          const newVersion = await tx.ideaVersion.create({
            data: {
              ideaId: job.ideaId,
              title: updatedIdea.title,
              description: updatedIdea.description,
              problem: updatedIdea.problem,
              valueProposition: updatedIdea.valueProposition,
              targetUser: updatedIdea.targetUser,
              monetization: updatedIdea.monetization,
              phase: versionPhase,
              score: updatedIdea.score,
              verdict: updatedIdea.verdict,
              reportsSnapshot: reportsForSnapshot.length > 0 ? reportsForSnapshot : undefined,
            },
          });

          // If the idea didn't have a current version yet (first validation
          // of a brand-new idea), the reports created above carry no
          // ideaVersionId — attach them to the freshly created version now.
          if (!ideaForReport?.currentVersionId) {
            await tx.report.updateMany({
              where: { ideaId: job.ideaId, ideaVersionId: null },
              data: { ideaVersionId: newVersion.id },
            });
          }

          // Set currentVersionId on the Idea
          await tx.idea.update({
            where: { id: job.ideaId },
            data: { currentVersionId: newVersion.id },
          });
        }
      }
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
