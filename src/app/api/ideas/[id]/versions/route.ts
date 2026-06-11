import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { backfillCurrentVersion } from "@/lib/backfill-current-version";
import { guardIdeaOrBridge } from "@/lib/ownership";

let backfillRan = false;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardIdeaOrBridge(req, id);
    if (!guard.ok) return guard.response;

    const idea = await prisma.idea.findUnique({
      where: { id },
      select: { id: true, currentVersionId: true },
    });
    if (!idea) {
      return NextResponse.json(
        { error: "Idea no encontrada" },
        { status: 404 }
      );
    }

    // Run backfill once on first request
    if (!backfillRan) {
      backfillRan = true;
      backfillCurrentVersion().catch((err) =>
        console.error("[backfillCurrentVersion] error:", err)
      );
    }

    const versions = await prisma.ideaVersion.findMany({
      where: { ideaId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      currentVersionId: idea.currentVersionId,
      versions,
    });
  } catch (error) {
    console.error("[GET /api/ideas/:id/versions]", error);
    return NextResponse.json(
      { error: "Error al obtener las versiones" },
      { status: 500 }
    );
  }
}
