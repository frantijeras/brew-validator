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
              description: "Investigación de mercado, competencia, TAM/SAM/SOM y canales recomendados según el target",
              status: "AVAILABLE",
              sortOrder: 1,
            },
            {
              type: "IDENTITY",
              label: "Identidad de Marca",
              description: "Naming, voz y tono, estilo visual (style guide HTML) y brand book final",
              status: "LOCKED",
              sortOrder: 2,
            },
            {
              type: "CONTENT",
              label: "Estrategia de Distribución",
              description: "Canales prioritarios, tipo de contenido, calendario editorial, plan de ads y estrategia de lanzamiento en redes",
              status: "LOCKED",
              sortOrder: 3,
            },
            {
              type: "DEVELOPMENT",
              label: "Landing Page",
              description: "Genera la estructura, copy y CTA de la landing inicial a partir de la estrategia de distribución y la identidad de marca",
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
              label: "Roadmap 30/60/90",
              description: "Plan paso a paso para los próximos 3 meses con hitos claros y acciones semanales",
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
