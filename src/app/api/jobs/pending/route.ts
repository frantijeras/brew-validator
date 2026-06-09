import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const MONITORED_AGENTS = [
  "skeptic", "advocate", "judge",
  "idea-generator", "brew-qa-refiner",
  "project-analyst", "project-branding", "project-content", "project-dev", "project-dossier",
  "project-business", "project-execution",
];

/**
 * GET /api/jobs/pending
 *
 * Returns PENDING jobs for the bridge daemon to process.
 * The bridge polls this endpoint every 10s.
 * Jobs already in RUNNING state are excluded to prevent double-processing.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ideaId = searchParams.get("ideaId");

    const where: Record<string, unknown> = {
      status: "PENDING",  // solo PENDING, no más RUNNING
      agentName: { in: MONITORED_AGENTS },
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
