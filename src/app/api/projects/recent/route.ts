import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        phases: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    const items = projects.map((p) => {
      const total = p.phases.length + 1; // +1 for inherited Phase 00
      const completedPhases = p.phases.filter((ph) => ph.status === "COMPLETED").length + 1; // +1 for inherited Phase 00
      const currentPhase = p.phases.find((ph) => ph.status !== "COMPLETED" && ph.status !== "LOCKED");

      return {
        id: p.id,
        name: p.name,
        completedPhases,
        total,
        currentPhaseType: currentPhase?.type ?? null,
        currentPhaseLabel: currentPhase?.label ?? null,
        status: p.phases.every((ph) => ph.status === "COMPLETED")
          ? "completed"
          : p.phases.some((ph) => ph.status === "PROCESSING")
            ? "processing"
            : p.phases.some((ph) => ph.status === "QUESTIONING")
              ? "questioning"
              : "available",
      };
    });

    return NextResponse.json(items);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
