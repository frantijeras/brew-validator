import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updateIdeaSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  problem: z.string().optional().nullable(),
  valueProposition: z.string().optional().nullable(),
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
        currentVersion: {
          select: { phase: true },
        },
        _count: {
          select: { versions: true },
        },
      },
    });

    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // Flatten _count and currentVersion into response
    const { _count, currentVersion, ...ideaData } = idea;
    return NextResponse.json({
      ...ideaData,
      _versionCount: _count.versions,
      currentVersionPhase: currentVersion?.phase ?? null,
    });
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

    // Cast status to IdeaStatus if present
    const updateData: Record<string, unknown> = { ...data };

    const idea = await prisma.idea.update({
      where: { id },
      data: updateData as Record<string, unknown>,
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // Cascade: delete versions, reports and jobs first, then the idea
    await prisma.$transaction([
      prisma.ideaVersion.deleteMany({ where: { ideaId: id } }),
      prisma.report.deleteMany({ where: { ideaId: id } }),
      prisma.job.deleteMany({ where: { ideaId: id } }),
      prisma.idea.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/ideas/:id]", error);
    return NextResponse.json(
      { error: "Error al eliminar la idea" },
      { status: 500 }
    );
  }
}
