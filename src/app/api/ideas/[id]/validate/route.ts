import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const AGENTS = ["skeptic", "advocate", "judge"];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    if (idea.validationStatus === "RUNNING") {
      return NextResponse.json(
        { error: "La validación ya está en curso" },
        { status: 409 }
      );
    }

    // Delete old reports and reset verdict/score
    await prisma.$transaction([
      prisma.report.deleteMany({ where: { ideaId: id } }),
      prisma.job.deleteMany({ where: { ideaId: id } }),
      prisma.idea.update({
        where: { id },
        data: {
          status: "VALIDATING",
          validationStatus: "RUNNING",
          verdict: null,
          score: null,
        },
      }),
    ]);

    // Create 3 PENDING jobs
    const input = JSON.stringify({
      title: idea.title,
      description: idea.description,
      targetUser: idea.targetUser,
      monetization: idea.monetization,
    });

    const jobs = await Promise.all(
      AGENTS.map((agentName) =>
        prisma.job.create({
          data: {
            ideaId: id,
            agentName,
            status: "PENDING",
            input,
          },
        })
      )
    );

    return NextResponse.json({
      status: "VALIDATING",
      validationStatus: "RUNNING",
      jobs: jobs.map((j) => ({ id: j.id, agentName: j.agentName, status: j.status })),
    });
  } catch (error) {
    console.error("[POST /api/ideas/:id/validate]", error);
    return NextResponse.json(
      { error: "Error al iniciar la validación" },
      { status: 500 }
    );
  }
}
