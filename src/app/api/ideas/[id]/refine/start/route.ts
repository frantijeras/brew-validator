import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardIdea } from "@/lib/ownership";

export async function POST(
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

    // Block start when another agent is working on the idea. POLISHING
    // is allowed (resume existing polish) and is handled below.
    if (
      idea.status === "GENERATING" ||
      idea.status === "VALIDATING" ||
      idea.status === "REFINING"
    ) {
      return NextResponse.json(
        { error: `No se puede iniciar el pulido en estado ${idea.status}. Espera a que termine.` },
        { status: 409 }
      );
    }

    if (idea.status === "POLISHING") {
      // Already polishing — return existing snapshot if any
      const meta = (idea.metadata as Record<string, unknown>) || {};
      return NextResponse.json({
        snapshot: meta.polishSnapshot || null,
        idea,
      });
    }

    const snapshot = {
      title: idea.title,
      description: idea.description,
      problem: idea.problem,
      valueProposition: idea.valueProposition,
      targetUser: idea.targetUser,
      monetization: idea.monetization,
    };

    const existingMeta = (idea.metadata as Record<string, unknown>) || {};

    const updated = await prisma.idea.update({
      where: { id },
      data: {
        status: "POLISHING",
        metadata: { ...existingMeta, polishSnapshot: snapshot },
      },
    });

    return NextResponse.json({ snapshot, idea: updated });
  } catch (error) {
    console.error("[POST /api/ideas/:id/refine/start]", error);
    return NextResponse.json(
      { error: "Error al iniciar el pulido" },
      { status: 500 }
    );
  }
}
