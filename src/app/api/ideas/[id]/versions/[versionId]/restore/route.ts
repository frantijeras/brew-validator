import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;

    const version = await prisma.ideaVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.ideaId !== id) {
      return NextResponse.json(
        { error: "Versión no encontrada" },
        { status: 404 }
      );
    }

    // Determine current (latest) version
    const latestVersion = await prisma.ideaVersion.findFirst({
      where: { ideaId: id },
      orderBy: { createdAt: "desc" },
    });

    if (latestVersion && version.id === latestVersion.id) {
      return NextResponse.json(
        { error: "Esta versión ya está activa" },
        { status: 400 }
      );
    }

    // Restore all idea fields from version snapshot
    const updated = await prisma.idea.update({
      where: { id },
      data: {
        title: version.title,
        description: version.description,
        problem: version.problem,
        valueProposition: version.valueProposition,
        targetUser: version.targetUser,
        monetization: version.monetization,
        score: version.score,
        verdict: version.verdict,
        status: "COMPLETED",
        validationStatus: "DONE",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[POST /api/ideas/:id/versions/:versionId/restore]", error);
    return NextResponse.json(
      { error: "Error al restaurar la versión" },
      { status: 500 }
    );
  }
}
