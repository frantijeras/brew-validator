import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const applyRefineSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  targetUser: z.string().min(3),
  monetization: z.string().min(3),
});

/**
 * POST /api/ideas/:id/refine/apply
 *
 * Creates an IdeaVersion with phase "pre-validation" when the user
 * accepts the refined changes from the QA refiner chat.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;
    const body = await req.json();
    const data = applyRefineSchema.parse(body);

    const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    const version = await prisma.ideaVersion.create({
      data: {
        ideaId,
        title: data.title,
        description: data.description,
        targetUser: data.targetUser,
        monetization: data.monetization,
        phase: "pre-validation",
      },
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    console.error("[POST /api/ideas/:id/refine/apply]", error);
    return NextResponse.json(
      { error: "Error al guardar la versión" },
      { status: 500 }
    );
  }
}
