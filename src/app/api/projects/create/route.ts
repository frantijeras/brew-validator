import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

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
              description: "Análisis DAFO, 5 Fuerzas de Porter, estimación de TAM/SAM/SOM, Lean Canvas, segmentos de cliente con Buyer Persona y propuesta de valor única",
              status: "AVAILABLE",
              sortOrder: 1,
            },
            {
              type: "BUSINESS",
              label: "Viabilidad Financiera",
              description: "Modelo de ingresos, estrategia de pricing, simulador financiero con Unit Economics, proyección LTV/CAC y análisis de viabilidad en 3 escenarios (pesimista, realista, optimista)",
              status: "LOCKED",
              sortOrder: 2,
            },
            {
              type: "IDENTITY",
              label: "Identidad de Marca",
              description: "Naming, voz y tono (12 Arquetipos de Jung), estilo visual (paletas de color, tipografías, style guide HTML) y brand book final",
              status: "LOCKED",
              sortOrder: 3,
            },
            {
              type: "CONTENT",
              label: "Estrategia de Distribución",
              description: "Matriz Bullseye, canales prioritarios, tipo de contenido, calendario editorial, pilares de contenido y estrategia de lanzamiento",
              status: "LOCKED",
              sortOrder: 4,
            },
            {
              type: "EXECUTION",
              label: "Roadmap 30/60/90",
              description: "Hoja de ruta detallada y OKRs (objetivos y resultados clave) para 30, 60 y 90 días",
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
