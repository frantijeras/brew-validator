import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { verifyBridgeSecret } from "@/lib/bridge-auth";

const MONITORED_AGENTS = [
  "skeptic", "advocate", "judge",
  "idea-generator", "brew-qa-refiner",
  "project-analyst", "project-branding", "project-content",
  "project-business", "project-execution", "project-skills",
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
    if (!verifyBridgeSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
