import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json(
        { error: "Idea no encontrada" },
        { status: 404 }
      );
    }

    const versions = await prisma.ideaVersion.findMany({
      where: { ideaId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(versions);
  } catch (error) {
    console.error("[GET /api/ideas/:id/versions]", error);
    return NextResponse.json(
      { error: "Error al obtener las versiones" },
      { status: 500 }
    );
  }
}
