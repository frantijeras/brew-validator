import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reformulateIdea } from "@/lib/reformulate";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return NextResponse.json(
        { error: "Las indicaciones para reformular deben tener al menos 3 caracteres" },
        { status: 400 }
      );
    }

    const idea = await prisma.idea.findUnique({
      where: { id },
      include: { reports: true },
    });

    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    const isCompleted =
      idea.validationStatus === "DONE" ||
      idea.status === "COMPLETED" ||
      idea.status === "DONE";

    if (!isCompleted && idea.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Solo se pueden reformular ideas en estado Borrador o ya validadas" },
        { status: 409 }
      );
    }

    const reformulated = reformulateIdea(
      {
        title: idea.title,
        description: idea.description,
        targetUser: idea.targetUser,
        monetization: idea.monetization,
      },
      prompt.trim()
    );

    // Build the update data
    const updateData: Record<string, unknown> = {
      title: reformulated.title,
      description: reformulated.description,
      targetUser: reformulated.targetUser,
      monetization: reformulated.monetization,
    };

    // If the idea was already validated, reset validation state and delete reports/jobs
    if (isCompleted) {
      updateData.validationStatus = "PENDING";
      updateData.status = "DRAFT";
      updateData.verdict = null;
      updateData.score = null;
    }

    const [updated] = await prisma.$transaction([
      prisma.idea.update({
        where: { id },
        data: updateData,
      }),
      // Delete reports and jobs if resetting
      ...(isCompleted
        ? [
            prisma.report.deleteMany({ where: { ideaId: id } }),
            prisma.job.deleteMany({ where: { ideaId: id } }),
          ]
        : []),
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[POST /api/ideas/:id/reformulate]", error);
    return NextResponse.json(
      { error: "Error al reformular la idea" },
      { status: 500 }
    );
  }
}
