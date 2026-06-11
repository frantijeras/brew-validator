import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardIdea } from "@/lib/ownership";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardIdea(id);
    if (!guard.ok) return guard.response;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json(
        { error: "Idea no encontrada" },
        { status: 404 }
      );
    }

    const meta = (idea.metadata as Record<string, unknown>) || {};
    const snapshot = meta.polishSnapshot as
      | {
          title: string;
          description: string;
          problem: string | null;
          valueProposition: string | null;
          targetUser: string;
          monetization: string;
        }
      | undefined;

    if (!snapshot) {
      return NextResponse.json(
        { error: "No hay snapshot para restaurar" },
        { status: 400 }
      );
    }

    const updated = await prisma.idea.update({
      where: { id },
      data: {
        title: snapshot.title,
        description: snapshot.description,
        problem: snapshot.problem,
        valueProposition: snapshot.valueProposition,
        targetUser: snapshot.targetUser,
        monetization: snapshot.monetization,
        status: "COMPLETED",
        validationStatus: "DONE",
        metadata: { ...meta, polishSnapshot: null },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/ideas/:id/refine/cancel]", error);
    return NextResponse.json(
      { error: "Error al cancelar el pulido" },
      { status: 500 }
    );
  }
}
