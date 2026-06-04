import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createIdeaSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  targetUser: z.string().min(3, "Indica quién es tu usuario objetivo"),
  monetization: z.string().min(3, "Describe tu modelo de monetización"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createIdeaSchema.parse(body);

    const ideaData = {
      title: data.title,
      description: data.description,
      originalIdea: data.description,
      targetUser: data.targetUser,
      monetization: data.monetization,
    };

    const idea = await prisma.idea.create({ data: ideaData });

    // No initial version created here — versions are append-only after validation.
    // currentVersionId stays null until the first successful validation creates V1.

    return NextResponse.json(idea, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    console.error("[POST /api/ideas]", error);
    return NextResponse.json(
      { error: "Error al crear la idea" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const ideas = await prisma.idea.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        currentVersion: {
          select: { phase: true },
        },
      },
    });

    // Flatten currentVersion.phase into response
    const result = ideas.map(({ currentVersion, ...idea }) => ({
      ...idea,
      currentVersionPhase: currentVersion?.phase ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/ideas]", error);
    return NextResponse.json(
      { error: "Error al obtener las ideas" },
      { status: 500 }
    );
  }
}
