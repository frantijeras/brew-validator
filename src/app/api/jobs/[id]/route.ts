import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardJobOrBridge } from "@/lib/ownership";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardJobOrBridge(req, id);
    if (!guard.ok) return guard.response;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        idea: {
          select: {
            id: true,
            title: true,
            validationStatus: true,
            verdict: true,
            score: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    // Parse output JSON if string
    let output = job.output;
    if (typeof output === "string") {
      try {
        output = JSON.parse(output);
      } catch {
        output = null;
      }
    }

    // Calculate elapsed seconds
    let elapsedSeconds = 0;
    if (job.startedAt) {
      const end = job.finishedAt ? new Date(job.finishedAt) : new Date();
      elapsedSeconds = Math.round(
        (end.getTime() - new Date(job.startedAt).getTime()) / 1000
      );
    }

    return NextResponse.json({
      id: job.id,
      ideaId: job.ideaId,
      agentName: job.agentName,
      status: job.status,
      output,
      error: job.error,
      elapsedSeconds,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      idea: job.idea,
    });
  } catch (error) {
    console.error("[GET /api/jobs/:id]", error);
    return NextResponse.json(
      { error: "Error al obtener el job" },
      { status: 500 }
    );
  }
}
