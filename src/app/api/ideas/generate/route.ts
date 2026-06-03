import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const generateIdeaSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("random"),
  }),
  z.object({
    mode: z.literal("custom"),
    rawIdea: z
      .string()
      .min(10, "La idea debe tener al menos 10 caracteres")
      .max(2000, "La idea no puede superar los 2000 caracteres"),
    sector: z.string().optional(),
    targetUser: z.string().optional(),
    hints: z.string().optional(),
  }),
]);

// ── POST ──

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = generateIdeaSchema.parse(body);

    // Build job input
    const jobInput =
      data.mode === "random"
        ? { rawIdea: "random" }
        : {
            rawIdea: data.rawIdea.trim(),
            sector: data.sector?.trim() || "",
            targetUser: data.targetUser?.trim() || "",
            hints: data.hints?.trim() || "",
          };

    // Create placeholder idea
    const placeholderTitle =
      data.mode === "random"
        ? "Generando idea aleatoria…"
        : data.rawIdea.trim().slice(0, 80);

    const idea = await prisma.idea.create({
      data: {
        title: placeholderTitle,
        description: data.mode === "custom" ? data.rawIdea.trim() : "Buscando tendencias de mercado…",
        targetUser: data.targetUser?.trim() || "Por determinar",
        monetization: "Por determinar",
        status: "GENERATING",
        validationStatus: "PENDING",
        originalIdea: data.mode === "custom" ? data.rawIdea.trim() : null,
      },
    });

    // Create PENDING job for the idea-generator agent
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
        success: true,
        ideaId: idea.id,
        jobId: job.id,
        status: "PENDING",
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
      { error: "Error al generar la idea" },
      { status: 500 }
    );
  }
}
