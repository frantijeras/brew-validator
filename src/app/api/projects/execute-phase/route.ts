import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { projectId, phaseId, phaseType } = await req.json();
    if (!projectId || !phaseId || !phaseType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }
    if (phase.status !== "AVAILABLE") {
      return NextResponse.json({ error: "Phase is not available" }, { status: 409 });
    }

    // Get full project + idea context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        idea: {
          include: {
            reports: { orderBy: { createdAt: "desc" }, take: 5 },
            currentVersion: true,
          },
        },
        phases: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const idea = project.idea;

    // Build context from idea
    const ideaContext = `
Título: ${idea.title}
Descripción: ${idea.description}
Problema: ${idea.problem || "N/A"}
Propuesta de valor: ${idea.valueProposition || "N/A"}
Usuario objetivo: ${idea.targetUser}
Monetización: ${idea.monetization}
Modelo de negocio: ${idea.businessModel || "N/A"}
Veredicto: ${idea.verdict || "N/A"}
Score: ${idea.score || "N/A"}
    `.trim();

    const latestReport = idea.reports[0];
    const reportContext = latestReport
      ? `\n\nInforme de validación:\n${latestReport.content?.slice(0, 2000)}`
      : "";

    const fullContext = ideaContext + reportContext;

    // Generate phase output (placeholder — will be real AI generation)
    let artifactTitle = "";
    let artifactContent = "";

    switch (phaseType) {
      case "IDENTITY": {
        artifactTitle = "Briefing de Identidad";
        artifactContent = `# Briefing de Identidad — ${project.name}

Basado en la idea validada y su análisis, se ha generado el siguiente briefing de identidad de marca.

## Naming

*Opciones de nombre pendientes de generación con IA*

## Tono de Voz

*Definición de personalidad de marca pendiente*

## Estilo Visual

*Descripción visual pendiente*

---

*Contexto utilizado:* ${fullContext.slice(0, 500)}...
`;
        break;
      }
      case "ANALYSIS": {
        artifactTitle = "Análisis de Mercado";
        artifactContent = `# Análisis de Mercado — ${project.name}

*Fase en desarrollo — disponible tras completar Identidad de Marca*`;
        break;
      }
      case "CONTENT": {
        artifactTitle = "Guía de Contenido";
        artifactContent = `# Guía de Contenido — ${project.name}

*Fase en desarrollo — disponible tras completar Análisis de Mercado*`;
        break;
      }
      case "DEVELOPMENT": {
        artifactTitle = "Skill de Desarrollo";
        artifactContent = `# Skill de Desarrollo — ${project.name}

*Fase en desarrollo — disponible tras completar Contenido y Publicación*`;
        break;
      }
      case "DOSSIER": {
        artifactTitle = "Dossier Completo";
        // Collect all phase artifacts
        const allPhases = project.phases;
        const allArtifacts = allPhases
          .filter((p) => p.artifacts)
          .flatMap((p) => (p.artifacts as Array<{ title: string; content: string }>) || []);

        artifactContent = `# Dossier Completo — ${project.name}

## Contexto Original
${fullContext}

## Artefactos Generados

${allArtifacts.map((a) => `### ${a.title}\n\n${a.content}`).join("\n\n---\n\n")}
`;
        break;
      }
    }

    // Update phase as completed with artifact
    await prisma.projectPhase.update({
      where: { id: phaseId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        artifacts: [
          {
            title: artifactTitle,
            content: artifactContent,
            type: phaseType,
          },
        ],
      },
    });

    // Unlock next phase
    const nextPhase = await prisma.projectPhase.findFirst({
      where: { projectId, sortOrder: phase.sortOrder + 1 },
    });
    if (nextPhase) {
      await prisma.projectPhase.update({
        where: { id: nextPhase.id },
        data: { status: "AVAILABLE" },
      });
    }

    return NextResponse.json({ success: true, artifact: { title: artifactTitle } });
  } catch (error) {
    console.error("Error executing phase:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
