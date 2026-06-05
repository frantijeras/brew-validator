import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
    const phaseType = (jobInput as any)?.phaseType;

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
        // ── REPORT MODE: store artifact, mark completed, unlock next ──
        const reportMarkdown =
          typeof parsedOutput.reportMarkdown === "string"
            ? parsedOutput.reportMarkdown
            : String(output);

        const extraFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsedOutput)) {
          if (k !== "reportMarkdown" && k !== "mode" && typeof v === "string") {
            extraFields[k] = v;
          }
        }

        const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
        if (phase) {
          const artifact = {
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
              artifacts: [artifact],
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

      // If phase was in a question/processing state, unlock it so user can retry
      if (phaseId) {
        const phase = await prisma.projectPhase.findUnique({
          where: { id: phaseId },
        });
        if (phase && (phase.status === "QUESTIONING" || phase.status === "PROCESSING")) {
          await prisma.projectPhase.update({
            where: { id: phaseId },
            data: { status: "AVAILABLE" },
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
