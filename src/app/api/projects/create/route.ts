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
    // so it is NOT a ProjectPhase here. The 6 phases below are the agent-driven ones.
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
              description: "Investigación de mercado, competencia, TAM/SAM/SOM y estrategia de lanzamiento",
              status: "AVAILABLE",
              sortOrder: 1,
            },
            {
              type: "IDENTITY",
              label: "Identidad de Marca",
              description: "Naming, tono de voz, estilo visual y personalidad de marca",
              status: "LOCKED",
              sortOrder: 2,
            },
            {
              type: "CONTENT",
              label: "Estrategia de Contenido",
              description: "Guía de contenido, skill de publicación y landing promocional",
              status: "LOCKED",
              sortOrder: 3,
            },
            {
              type: "DEVELOPMENT",
              label: "Plan Técnico y de Producto",
              description: "Skill de desarrollo con contexto completo y plan técnico",
              status: "LOCKED",
              sortOrder: 4,
            },
            {
              type: "BUSINESS",
              label: "Estrategia de Negocio",
              description: "Modelo de negocio, pricing, métricas clave y plan financiero",
              status: "LOCKED",
              sortOrder: 5,
            },
            {
              type: "EXECUTION",
              label: "Plan de Ejecución",
              description: "Exportación de todo el proyecto en un MD ejecutable",
              status: "LOCKED",
              sortOrder: 6,
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
