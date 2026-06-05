import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveModelForJobAgent } from "@/lib/agent-models";

export async function POST(req: Request) {
  try {
    const { projectId, phaseId, phaseType, modelOverride } = await req.json();
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

    // Get full project + idea context + previous phase artifacts
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

    // Build idea context for the agent
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

    // Get previous phase artifacts
    const previousArtifacts = project.phases
      .filter((p) => p.artifacts)
      .map((p) => {
        const arts = p.artifacts as Array<{ title: string; content: string }> | null;
        return arts?.[0] || null;
      })
      .filter(Boolean);

    // Determine agent name
    const agentName = `project-${phaseType.toLowerCase()}`;

    // Resolve the model
    const model = modelOverride || (await resolveModelForJobAgent(agentName));

    // Create a job in the DB
    const job = await prisma.job.create({
      data: {
        ideaId: idea.id,
        agentName,
        status: "PENDING",
        input: JSON.stringify({
          projectId,
          phaseId,
          ideaContext,
          previousArtifacts,
          _bridgeModel: model,
        }),
      },
    });

    // Mark the phase as IN_PROGRESS
    await prisma.projectPhase.update({
      where: { id: phaseId },
      data: { status: "AVAILABLE" },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: "Fase iniciada. El bridge la procesará en breve.",
    });
  } catch (error) {
    console.error("Error executing phase:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
