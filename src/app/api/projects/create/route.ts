import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PHASE_DESCRIPTIONS } from "@/lib/phase-descriptions";

export async function POST(req: Request) {
  try {
    const { ideaId } = await req.json();
    if (!ideaId) {
      return NextResponse.json({ error: "ideaId required" }, { status: 400 });
    }

    // Check idea exists and is completed
    const idea = await prisma.idea.findUnique({
      where: { id: ideaId },
      include: { project: true },
    });

    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    if (idea.project) {
      return NextResponse.json(
        { error: "Esta idea ya tiene un proyecto", projectId: idea.project.id },
        { status: 409 }
      );
    }

    // Same precondition the UI enforces: only validated ideas become projects
    if (idea.status !== "COMPLETED" && idea.validationStatus !== "DONE") {
      return NextResponse.json(
        { error: "La idea debe estar validada antes de convertirla en proyecto" },
        { status: 409 }
      );
    }

    // Create the project with its phases
    // Phase 0 (VALIDATION) is read-only on the frontend and points to /ideas/[id],
    // so it is NOT a ProjectPhase here. The 5 phases below are the agent-driven ones.
    const project = await prisma.project.create({
      data: {
        ideaId: idea.id,
        name: idea.title,
        description: idea.description?.slice(0, 300),
        phases: {
          create: [
            {
              type: "ANALYSIS",
              label: "Análisis de Mercado",
              description: PHASE_DESCRIPTIONS.ANALYSIS,
              status: "AVAILABLE",
              sortOrder: 1,
            },
            {
              type: "BUSINESS",
              label: "Viabilidad Financiera",
              description: PHASE_DESCRIPTIONS.BUSINESS,
              status: "LOCKED",
              sortOrder: 2,
            },
            {
              type: "IDENTITY",
              label: "Identidad de Marca",
              description: PHASE_DESCRIPTIONS.IDENTITY,
              status: "LOCKED",
              sortOrder: 3,
            },
            {
              type: "CONTENT",
              label: "Estrategia de Distribución",
              description: PHASE_DESCRIPTIONS.CONTENT,
              status: "LOCKED",
              sortOrder: 4,
            },
            {
              type: "EXECUTION",
              label: "Roadmap 30/60/90",
              description: PHASE_DESCRIPTIONS.EXECUTION,
              status: "LOCKED",
              sortOrder: 5,
            },

          ],
        },
      },
      include: { phases: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ project });
  } catch (error) {
    // Unique constraint on Project.ideaId: two concurrent requests both passed
    // the idea.project check — treat the loser as "already exists".
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Esta idea ya tiene un proyecto" },
        { status: 409 }
      );
    }
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
