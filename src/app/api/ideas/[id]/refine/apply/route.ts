import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getNextVersionPhase } from "@/lib/versions";

const applyRefineSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  problem: z.string().optional(),
  valueProposition: z.string().optional(),
  targetUser: z.string().min(3),
  monetization: z.string().min(3),
});

/**
 * POST /api/ideas/:id/refine/apply
 *
 * Applies refined changes: creates a new IdeaVersion with incremented phase,
 * updates the idea fields, sets status to DRAFT, and clears the polish snapshot.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;
    const body = await req.json();
    const data = applyRefineSchema.parse(body);

    const idea = await prisma.idea.findUnique({
      where: { id: ideaId },
      include: { _count: { select: { versions: true } } },
    });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // Clear polishSnapshot from metadata
    const rawMeta = idea.metadata as Record<string, unknown> | null;
    const existingMeta: Record<string, unknown> =
      rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
        ? rawMeta
        : {};
    const { polishSnapshot: _removed, ...restMeta } = existingMeta;

    // Create version and update idea in a transaction, setting currentVersionId.
    // The version count is read INSIDE the transaction so that two concurrent
    // "apply" calls don't race to create versions with the same number.
    const [version, updated] = await prisma.$transaction(async (tx) => {
      // Compute next version phase atomically
      const nextPhase = await getNextVersionPhase(ideaId, tx);

      const newVersion = await tx.ideaVersion.create({
        data: {
          ideaId,
          title: data.title,
          description: data.description,
          problem: data.problem ?? null,
          valueProposition: data.valueProposition ?? null,
          targetUser: data.targetUser,
          monetization: data.monetization,
          phase: nextPhase,
        },
      });
      const updatedIdea = await tx.idea.update({
        where: { id: ideaId },
        data: {
          title: data.title,
          description: data.description,
          targetUser: data.targetUser,
          monetization: data.monetization,
          problem: data.problem ?? null,
          valueProposition: data.valueProposition ?? null,
          status: "DRAFT",
          validationStatus: "PENDING",
          score: null,
          verdict: null,
          metadata: restMeta as Prisma.InputJsonValue,
          currentVersionId: newVersion.id,
        },
      });
      return [newVersion, updatedIdea];
    });

    return NextResponse.json({ version, idea: updated }, { status: 201 });
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
