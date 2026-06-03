import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
