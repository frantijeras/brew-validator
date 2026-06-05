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
    const project = await prisma.project.create({
      data: {
        ideaId: idea.id,
        name: idea.title,
        description: idea.description?.slice(0, 300),
        status: "ACTIVE",
        phases: {
          create: [
            {
              type: "IDENTITY",
              label: "Identidad de Marca",
              description: "Naming, tono de voz, estilo visual y personalidad de marca",
              status: "AVAILABLE",
              sortOrder: 0,
            },
            {
              type: "ANALYSIS",
              label: "Análisis de Mercado",
              description: "Competencia, TAM/SAM/SOM y estrategia de lanzamiento",
              status: "LOCKED",
              sortOrder: 1,
            },
            {
              type: "CONTENT",
              label: "Contenido y Publicación",
              description: "Guía de contenido, skill de publicación y landing promocional",
              status: "LOCKED",
              sortOrder: 2,
            },
            {
              type: "DEVELOPMENT",
              label: "Desarrollo Técnico",
              description: "Skill de desarrollo con contexto completo y plan técnico",
              status: "LOCKED",
              sortOrder: 3,
            },
            {
              type: "DOSSIER",
              label: "Dossier Completo",
              description: "Exportación de todo el proyecto en un MD ejecutable",
              status: "LOCKED",
              sortOrder: 4,
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
