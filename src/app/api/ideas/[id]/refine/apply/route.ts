import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

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

    // Count existing versions with v{n} phase format to determine next version number
    const versionCount = await prisma.ideaVersion.count({
      where: {
        ideaId,
        phase: { startsWith: "v" },
      },
    });

    const nextPhase = `v${versionCount + 1}`;

    // Reports are anchored to the OLD current version (V1) via
    // ideaVersionId. The new version (V2) starts with no reports.
    // We do NOT delete them here — they remain visible whenever the
    // user navigates back to V1 from the version history.
    // (Snapshot restore was the previous mechanism; with per-version
    // Report links, the data is the source of truth.)

    // Build update payload, preserving existing values for optional fields
    const updateData: Record<string, unknown> = {
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
    };

    // Clear polishSnapshot from metadata
    const existingMeta = (idea.metadata as Record<string, unknown>) || {};
    const { polishSnapshot: _removed, ...restMeta } = existingMeta;
    updateData.metadata = restMeta;

    // Create version and update idea in a transaction, setting currentVersionId
    const [version, updated] = await prisma.$transaction(async (tx) => {
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
          ...updateData,
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
