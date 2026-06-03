import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const generateIdeaSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("random"),
  }),
  z.object({
    mode: z.literal("custom"),
    sector: z.string().min(3, "El sector debe tener al menos 3 caracteres"),
    targetUser: z.string().optional(),
    hints: z.string().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = generateIdeaSchema.parse(body);

    // Create a synthetic idea as a placeholder (title will be updated later)
    const idea = await prisma.idea.create({
      data: {
        title: data.mode === "random" ? "Idea aleatoria — generando…" : `Idea en ${data.sector} — generando…`,
        description: "Generada por IA. Los detalles se completarán cuando el agente termine.",
        targetUser: data.mode === "custom" ? (data.targetUser || "Por definir") : "Por definir",
        monetization: "Por definir",
        status: "GENERATING",
        validationStatus: "PENDING",
      },
    });

    // Create the job for the idea-generator agent
    const jobInput = {
      mode: data.mode,
      ...(data.mode === "custom"
        ? {
            sector: data.sector,
            targetUser: data.targetUser || "",
            hints: data.hints || "",
          }
        : {}),
    };

    const job = await prisma.job.create({
      data: {
        ideaId: idea.id,
        agentName: "idea-generator",
        status: "PENDING",
        input: JSON.stringify(jobInput),
      },
    });

    return NextResponse.json(
      {
        ideas: [],
        status: "PENDING" as const,
        jobId: job.id,
        ideaId: idea.id,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    console.error("[POST /api/ideas/generate]", error);
    return NextResponse.json(
      { error: "Error al crear la solicitud de generación" },
      { status: 500 }
    );
  }
}
