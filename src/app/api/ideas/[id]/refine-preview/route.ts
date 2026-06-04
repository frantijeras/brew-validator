import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const previewSchema = z.object({
  mode: z.literal("manual"),
  freeText: z.string().min(10, "El texto debe tener al menos 10 caracteres"),
});

const REFINER_AGENT = "brew-qa-refiner";

/**
 * POST /api/ideas/:id/refine-preview
 *
 * Encola un job para refinar la idea a partir de texto libre (modo manual).
 * El frontend debe hacer polling via GET /api/ideas/:id/refine?jobId=XXX
 * para obtener el resultado estructurado.
 *
 * NO aplica cambios — solo devuelve la versión estructurada para preview.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;
    const body = await req.json();
    const parsed = previewSchema.parse(body);

    const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    const jobInput = {
      idea: {
        title: idea.title,
        description: idea.description,
        problem: idea.problem,
        valueProposition: idea.valueProposition,
        targetUser: idea.targetUser,
        monetization: idea.monetization,
      },
      mode: "manual" as const,
      rawText: parsed.freeText.trim(),
    };

    const job = await prisma.job.create({
      data: {
        ideaId: idea.id,
        agentName: REFINER_AGENT,
        status: "PENDING",
        input: JSON.stringify(jobInput),
      },
    });

    return NextResponse.json({
      status: "PENDING",
      jobId: job.id,
      message: "Job encolado. Haz polling en GET /api/ideas/:id/refine?jobId=...",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    console.error("[POST /api/ideas/:id/refine-preview]", error);
    return NextResponse.json(
      { error: "Error al procesar la preview" },
      { status: 500 }
    );
  }
}
