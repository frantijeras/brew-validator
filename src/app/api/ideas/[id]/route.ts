import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updateIdeaSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  targetUser: z.string().min(3).optional(),
  monetization: z.string().min(3).optional(),
  status: z.string().optional(),
  isArchived: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idea = await prisma.idea.findUnique({
      where: { id },
      include: {
        reports: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    return NextResponse.json(idea);
  } catch (error) {
    console.error("[GET /api/ideas/:id]", error);
    return NextResponse.json(
      { error: "Error al obtener la idea" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateIdeaSchema.parse(body);

    const idea = await prisma.idea.update({
      where: { id },
      data,
    });

    return NextResponse.json(idea);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }
    console.error("[PATCH /api/ideas/:id]", error);
    return NextResponse.json(
      { error: "Error al actualizar la idea" },
      { status: 500 }
    );
  }
}
