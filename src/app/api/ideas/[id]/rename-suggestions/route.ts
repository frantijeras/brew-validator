import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveModelForJobAgent } from "@/lib/agent-models";

const RENAMER_AGENT = "idea-renamer";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;

    const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // Resolve the model configured in Settings for the renamer agent
    const bridgeModel = await resolveModelForJobAgent(RENAMER_AGENT);

    // Create a PENDING job for the bridge daemon
    const jobInput = {
      title: idea.title,
      description: idea.description,
      problem: idea.problem,
      targetUser: idea.targetUser,
      monetization: idea.monetization,
      businessModel: idea.businessModel,
    };

    const job = await prisma.job.create({
      data: {
        ideaId: idea.id,
        agentName: RENAMER_AGENT,
        status: "PENDING",
        input: JSON.stringify({ ...jobInput, _bridgeModel: bridgeModel }),
      },
    });

    return NextResponse.json({
      status: "PENDING",
      jobId: job.id,
    });
  } catch (error) {
    console.error("[POST /api/ideas/:id/rename-suggestions]", error);
    return NextResponse.json(
      { error: "Error al crear el job de sugerencias" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId requerido" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.ideaId !== ideaId) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    if (job.status === "COMPLETED") {
      let outputData: Record<string, unknown> = {};
      try {
        if (job.output) {
          outputData = JSON.parse(job.output);
        }
      } catch {
        // output not valid JSON yet
      }

      return NextResponse.json({
        status: "COMPLETED",
        suggestions: outputData.suggestions || [],
        jobId: job.id,
      });
    }

    if (job.status === "FAILED") {
      return NextResponse.json({
        status: "FAILED",
        error: job.error || "Error desconocido",
        jobId: job.id,
      });
    }

    return NextResponse.json({
      status: job.status,
      jobId: job.id,
    });
  } catch (error) {
    console.error("[GET /api/ideas/:id/rename-suggestions]", error);
    return NextResponse.json(
      { error: "Error al consultar sugerencias" },
      { status: 500 }
    );
  }
}
