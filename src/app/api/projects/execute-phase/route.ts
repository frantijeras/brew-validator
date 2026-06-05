import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveModelForJobAgent } from "@/lib/agent-models";

export async function POST(req: Request) {
  try {
    const { projectId, phaseId, phaseType, mode = "questions", answers, modelOverride } = await req.json();
    if (!projectId || !phaseId || !phaseType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    // Validate phase status based on mode
    if (mode === "questions" && phase.status !== "AVAILABLE") {
      return NextResponse.json({ error: "Phase is not available for questions" }, { status: 409 });
    }
    if (mode === "report" && phase.status !== "QUESTIONING") {
      return NextResponse.json({ error: "Phase must be in QUESTIONING state to submit answers" }, { status: 409 });
    }

    // Get project with idea context + previous phase artifacts
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        idea: {
          include: {
            reports: { orderBy: { createdAt: "desc" }, take: 1 },
            currentVersion: true,
          },
        },
        phases: {
          orderBy: { sortOrder: "asc" },
          where: { status: "COMPLETED" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const idea = project.idea;
    const latestReport = idea.reports[0];

    const ideaContext = {
      title: idea.title,
      description: idea.description,
      problem: idea.problem || "",
      valueProposition: idea.valueProposition || "",
      targetUser: idea.targetUser,
      monetization: idea.monetization,
      businessModel: idea.businessModel || "",
      verdict: idea.verdict || "",
      score: idea.score || 0,
      judgeReport: latestReport?.content?.slice(0, 3000) || "",
    };

    const previousArtifacts = project.phases
      .filter((p) => p.artifacts)
      .map((p) => {
        const arts = p.artifacts as Array<{ title: string; content: string }> | null;
        return arts?.[0] || null;
      })
      .filter(Boolean);

    // Map phaseType → agent name (phase types != agent names)
    const PHASE_TO_AGENT: Record<string, string> = {
      ANALYSIS: "project-analyst",
      IDENTITY: "project-branding",
      CONTENT: "project-content",
      DEVELOPMENT: "project-dev",
      DOSSIER: "project-dossier",
    };
    const agentName = PHASE_TO_AGENT[phaseType] || `project-${phaseType.toLowerCase()}`;
    const model = modelOverride || (await resolveModelForJobAgent(agentName));

    // Build job input
    const jobInput: Record<string, unknown> = {
      mode,
      projectId,
      phaseId,
      phaseType,
      ideaContext,
      previousArtifacts,
      _bridgeModel: model,
    };

    if (mode === "report" && answers) {
      jobInput.answers = answers;
    }

    // Create a job in the DB
    const job = await prisma.job.create({
      data: {
        ideaId: idea.id,
        agentName,
        status: "PENDING",
        input: JSON.stringify(jobInput),
      },
    });

    // Update phase status
    if (mode === "questions") {
      await prisma.projectPhase.update({
        where: { id: phaseId },
        data: { status: "PROCESSING" },
      });
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: mode === "questions"
        ? "Generando preguntas personalizadas..."
        : "Generando informe con tus respuestas...",
    });
  } catch (error) {
    console.error("Error executing phase:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
