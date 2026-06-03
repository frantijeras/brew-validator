import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/jobs/pending
 *
 * Returns PENDING or RUNNING jobs for the bridge daemon to process.
 * The bridge polls this endpoint every 10s.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ideaId = searchParams.get("ideaId");

    const where: Record<string, unknown> = {
      status: { in: ["PENDING", "RUNNING"] },
      agentName: { in: ["skeptic", "advocate", "judge", "idea-generator"] },
    };

    if (ideaId) {
      where.ideaId = ideaId;
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("[GET /api/jobs/pending]", error);
    return NextResponse.json({ error: "Error al obtener jobs" }, { status: 500 });
  }
}
