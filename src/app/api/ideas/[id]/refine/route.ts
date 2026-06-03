import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const refineSchema = z.object({
  message: z.string().min(1, "El mensaje no puede estar vacío"),
});

const REFINER_AGENT = "brew-qa-refiner";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;
    const body = await req.json();
    const { message } = refineSchema.parse(body);

    // Find the idea
    const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // Look for existing RUNNING or PENDING job for this idea + agent
    const existingJob = await prisma.job.findFirst({
      where: {
        ideaId,
        agentName: REFINER_AGENT,
        status: { in: ["PENDING", "RUNNING"] },
      },
    });

    let job = existingJob;
    let conversationHistory: Array<{ role: string; content: string }> = [];

    if (job) {
      // Parse existing conversation history from job input
      try {
        const prevInput = job.input ? JSON.parse(job.input) : {};
        conversationHistory = prevInput.conversationHistory || [];
      } catch {
        conversationHistory = [];
      }

      // Check if the agent already returned DONE
      try {
        if (job.output) {
          const prevOutput = JSON.parse(job.output);
          if (prevOutput.status === "DONE") {
            return NextResponse.json({
              status: "DONE",
              message: prevOutput.summary || "Refinamiento completado",
              summary: prevOutput.summary,
              title: prevOutput.title,
              description: prevOutput.description,
              targetUser: prevOutput.targetUser,
              monetization: prevOutput.monetization,
              jobId: job.id,
            });
          }
        }
      } catch {
        // output not valid JSON yet, continue
      }
    }

    // Add user message to conversation
    conversationHistory.push({ role: "user", content: message });

    const jobInput = {
      idea: {
        title: idea.title,
        description: idea.description,
        targetUser: idea.targetUser,
        monetization: idea.monetization,
      },
      conversationHistory,
    };

    if (!job) {
      // Create new job
      job = await prisma.job.create({
        data: {
          ideaId,
          agentName: REFINER_AGENT,
          status: "PENDING",
          input: JSON.stringify(jobInput),
        },
      });
    } else {
      // Update existing job with new input
      job = await prisma.job.update({
        where: { id: job.id },
        data: {
          input: JSON.stringify(jobInput),
          status: "PENDING", // Reset to PENDING so bridge picks it up
        },
      });
    }

    return NextResponse.json({
      status: "RUNNING",
      message: "Procesando tu respuesta...",
      jobId: job.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    console.error("[POST /api/ideas/:id/refine]", error);
    return NextResponse.json(
      { error: "Error al procesar el refinamiento" },
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
    if (!job) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    // Parse output for RUNNING state — get the agent's message
    let outputData: Record<string, unknown> = {};
    try {
      if (job.output) {
        outputData = JSON.parse(job.output);
      }
    } catch {
      // output not valid JSON yet
    }

    if (outputData.status === "DONE") {
      return NextResponse.json({
        status: "DONE",
        message: outputData.summary || "Refinamiento completado",
        summary: outputData.summary,
        title: outputData.title,
        description: outputData.description,
        targetUser: outputData.targetUser,
        monetization: outputData.monetization,
        jobId: job.id,
      });
    }

    if (job.status === "RUNNING" || job.status === "PENDING") {
      return NextResponse.json({
        status: "RUNNING",
        message: outputData.message || "Procesando...",
        jobId: job.id,
      });
    }

    if (job.status === "FAILED") {
      return NextResponse.json({
        status: "FAILED",
        message: job.error || "Error en el refinamiento",
        jobId: job.id,
      });
    }

    return NextResponse.json({
      status: job.status,
      message: "Esperando...",
      jobId: job.id,
    });
  } catch (error) {
    console.error("[GET /api/ideas/:id/refine]", error);
    return NextResponse.json(
      { error: "Error al consultar el refinamiento" },
      { status: 500 }
    );
  }
}
