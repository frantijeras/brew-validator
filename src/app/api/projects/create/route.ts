import { NextResponse } from "next/server";
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

    // Create the project with its phases
    // Phase 0 (VALIDATION) is read-only on the frontend and points to /ideas/[id],
    // so it is NOT a ProjectPhase here. The 5 phases below are the agent-driven ones.
    const project = await prisma.project.create({
      data: {
        ideaId: idea.id,
        name: idea.title,
        description: idea.description?.slice(0, 300),
        status: "ACTIVE",
        phases: {
          create: [
            {
              type: "ANALYSIS",
              label: "Análisis de Mercado",
              description: "Investigación de mercado, DAFO, 5 Fuerzas de Porter, TAM/SAM/SOM y canales recomendados según el target",
              status: "AVAILABLE",
              sortOrder: 1,
            },
            {
              type: "BUSINESS",
              label: "Estrategia de Negocio",
              description: "Lean Canvas, modelo de ingresos, pricing, segmentos de cliente y propuesta de valor estratégica",
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
              description: "OKRs 30/60/90, simulador financiero con unit economics y 3 escenarios, y plan financiero detallado",
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
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
