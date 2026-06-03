import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const callbackSchema = z.object({
  jobId: z.string(),
  status: z.enum(["COMPLETED", "FAILED"]),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  cost: z.number().positive().optional(),
});

const VALIDATION_AGENTS = ["skeptic", "advocate", "judge"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = callbackSchema.parse(body);

    const job = await prisma.job.findUnique({ where: { id: data.jobId } });
    if (!job) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    const isValidationAgent = VALIDATION_AGENTS.includes(job.agentName);

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

      return NextResponse.json({ success: true });
    }

    // COMPLETED
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

    // ── Validation agent callback (skeptic / advocate / judge) ──

    // Create or update report
    const reportContent = (output.reportMarkdown as string) || JSON.stringify(output);
    const verdict = (output.verdict as string) || "";
    const scorecard = (output.scorecard as string) || "";

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
        },
      });
    }

    // Check if all 3 agents are done → update idea with final verdict
    const pendingJobs = await prisma.job.count({
      where: {
        ideaId: job.ideaId,
        agentName: { in: ["skeptic", "advocate", "judge"] },
        status: { in: ["PENDING", "RUNNING"] },
      },
    });

    if (pendingJobs === 0) {
      // Re-read all reports fresh from DB
      const allReports = await prisma.report.findMany({
        where: { ideaId: job.ideaId },
      });

      const judgeReport = allReports.find(r => r.agentName === "judge");
      const judgeJob = await prisma.job.findFirst({
        where: { ideaId: job.ideaId, agentName: "judge", status: "COMPLETED" },
        select: { output: true },
      });

      let updateData: Record<string, unknown> = {
        validationStatus: "DONE",
        status: "COMPLETED",
      };

      if (judgeReport) {
        if (judgeReport.verdict) updateData.verdict = judgeReport.verdict;

        if (judgeReport.scorecard) {
          try {
            const sc = JSON.parse(judgeReport.scorecard);
            const score = sc.Total || sc.total || sc.puntuacion || null;
            if (score) updateData.score = Math.round(score);
          } catch {
            // ignore
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
        } catch {}
      }

      await prisma.idea.update({
        where: { id: job.ideaId },
        data: updateData,
      });
    }

    // Track cost
    if (cost > 0) {
      const idea = await prisma.idea.findUnique({
        where: { id: job.ideaId },
        select: { title: true },
      });
    }

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
