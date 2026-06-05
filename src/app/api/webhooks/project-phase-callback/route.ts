import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId, status, output } = body;

    if (!jobId || !status) {
      return NextResponse.json({ error: "Missing jobId or status" }, { status: 400 });
    }

    // Find the job
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (status === "COMPLETED" && output) {
      // Parse the output to extract reportMarkdown
      let reportMarkdown = "";
      let extraFields: Record<string, string> = {};

      try {
        const parsed = typeof output === "string" ? JSON.parse(output) : output;
        if (typeof parsed === "object") {
          reportMarkdown = parsed.reportMarkdown || "";
          extraFields = parsed;
          delete extraFields.reportMarkdown;
        } else {
          reportMarkdown = String(output);
        }
      } catch {
        reportMarkdown = String(output);
      }

      // Find the phase associated with this job
      // The job input contains project context
      const rawInput = job.input;
      const jobInput =
        typeof rawInput === "string"
          ? JSON.parse(rawInput)
          : rawInput && typeof rawInput === "object"
            ? (rawInput as Record<string, unknown>)
            : {};
      const projectId = (jobInput as any)?.projectId;
      const phaseId = (jobInput as any)?.phaseId;

      if (projectId && phaseId) {
        // Get the current phase to find its sort order
        const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
        if (phase) {
          // Build the artifact
          const artifact = {
            title: phase.label,
            content: reportMarkdown,
            type: phase.type,
            ...extraFields,
          };

          // Update phase status to COMPLETED with artifact
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
          output: reportMarkdown,
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
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/webhooks/project-phase-callback]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
