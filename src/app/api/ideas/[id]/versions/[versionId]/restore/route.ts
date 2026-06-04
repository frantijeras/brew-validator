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

    const updated = await prisma.idea.update({
      where: { id },
      data: {
        title: version.title,
        description: version.description,
        targetUser: version.targetUser,
        monetization: version.monetization,
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
