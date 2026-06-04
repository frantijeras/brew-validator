import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { BUSINESS_MODELS } from "@/lib/business-models";
import { resolveModelForJobAgent } from "@/lib/agent-models";

const generateIdeaSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("random"),
    businessModel: z.string().optional(),
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
    businessModel: z.string().optional(),
  }),
]);

// ── POST ──

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = generateIdeaSchema.parse(body);

    // Build job input
    // For random mode: if no business model specified, pick one randomly
    const resolvedBusinessModel =
      data.mode === "random" && !data.businessModel?.trim()
        ? (() => {
            const models = BUSINESS_MODELS.map((m) => m.value);
            return models[Math.floor(Math.random() * models.length)];
          })()
        : data.businessModel?.trim() || undefined;

    const jobInput =
      data.mode === "random"
        ? { rawIdea: "random", businessModel: resolvedBusinessModel, problem: "Por determinar", valueProposition: "Por determinar" }
        : {
            rawIdea: data.rawIdea.trim(),
            sector: data.sector?.trim() || "",
            targetUser: data.targetUser?.trim() || "",
            hints: data.hints?.trim() || "",
            businessModel: data.businessModel?.trim() || undefined,
            problem: "Por determinar",
            valueProposition: "Por determinar",
          };

    const placeholderTitle =
      data.mode === "random"
        ? "Generando idea aleatoria…"
        : data.rawIdea.trim().slice(0, 80);

    const ideaData: Record<string, unknown> = {
      title: placeholderTitle,
      status: "GENERATING",
      validationStatus: "PENDING",
    };

    if (resolvedBusinessModel) {
      ideaData.businessModel = resolvedBusinessModel;
    }

    if (data.mode === "custom") {
      ideaData.description = data.rawIdea.trim();
      ideaData.targetUser = data.targetUser?.trim() || "Por determinar";
      ideaData.monetization = "Por determinar";
      ideaData.problem = null;
      ideaData.valueProposition = null;
      ideaData.originalIdea = data.rawIdea.trim();
    } else {
      ideaData.description = "Buscando tendencias de mercado…";
      ideaData.targetUser = "Por determinar";
      ideaData.monetization = "Por determinar";
      ideaData.problem = null;
      ideaData.valueProposition = null;
    }

    const idea = await prisma.idea.create({
      data: ideaData as Parameters<typeof prisma.idea.create>[0]["data"],
    });

    // Resolve the model configured in Settings for this agent
    const agentName = "idea-generator";
    const bridgeModel = await resolveModelForJobAgent(agentName);

    // Create PENDING job for the idea-generator agent
    const job = await prisma.job.create({
      data: {
        ideaId: idea.id,
        agentName,
        status: "PENDING",
        input: JSON.stringify({ ...jobInput, _bridgeModel: bridgeModel }),
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
