import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { assertCanAccessHandoff } from "@/lib/quota";
import { buildHandoffZip } from "@/lib/handoff-builder";
import type { ProjectMemory } from "@/lib/project-memory";
import type { HandoffOptions } from "@/lib/handoff-builder";

/**
 * GET /api/projects/[id]/handoff
 *
 * Returns a complete "Handoff Package" ZIP for a project.
 * The ZIP contains all completed phase artifacts organized in a
 * directory structure, plus executable agent skills ready for
 * Cline, Cursor or Copilot.
 *
 * Only phases with status COMPLETED are included in the ZIP.
 * The ZIP is built entirely in memory using archiver.
 *
 * Responses:
 *  - 200: application/zip body with `Content-Disposition: attachment`.
 *  - 404: project not found.
 *  - 409: fewer than 4 phases completed (not enough to generate handoff).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;

    // Gate de Hand-off (admin o flag canAccessHandoff).
    const gate = await assertCanAccessHandoff(guard.userId as string);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        idea: true,
        phases: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    const completedPhases = project.phases.filter(
      (p) => p.status === "COMPLETED"
    );

    // Require at least 4 completed phases to generate a meaningful handoff
    if (completedPhases.length < 4) {
      return NextResponse.json(
        {
          error:
            "El handoff requiere al menos 4 fases completadas. Actualmente hay " +
            completedPhases.length +
            ".",
          completedCount: completedPhases.length,
          requiredCount: 4,
        },
        { status: 409 }
      );
    }

    const idea = project.idea;

    // ── Load selected skills from project ──
    const selectedSkills = (project.skills as Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      confidence: number;
      reason: string;
      recommended: boolean;
      selected?: boolean;
      custom?: boolean;
    }> | null)?.filter(s => s.selected !== false) ?? [];

    const generatedSkills = (project.generatedSkills as Array<{
      id: string;
      name: string;
      content: string;
    }> | null) ?? null;

    // ── Build HandoffOptions ──
    const handoffOptions: HandoffOptions = {
      projectId: project.id,
      projectName: project.name,
      ideaContext: {
        title: idea.title,
        description: idea.description,
        problem: idea.problem || "",
        valueProposition: idea.valueProposition || "",
        targetUser: idea.targetUser,
        monetization: idea.monetization,
        businessModel: idea.businessModel || "",
      },
      phases: project.phases.map((p) => ({
        type: p.type,
        label: p.label,
        sortOrder: p.sortOrder,
        status: p.status,
        description: p.description,
        artifacts: p.artifacts as Array<{
          title: string;
          content: string;
          type: string;
        }> | null,
        subStepArtifact: p.subStepArtifact as {
          type?: string;
          content?: string;
          options?: Array<{ value: string; label: string }>;
        } | null,
        subStepChoice: p.subStepChoice,
        subStep: p.subStep,
        subStepHistory: p.subStepHistory,
      })),
      memory: project.memory as ProjectMemory | null,
      selectedSkills,
      generatedSkills,
    };

    // ── Build ZIP ──
    const zipBuffer = await buildHandoffZip(handoffOptions);

    // Sanitize project name for filename
    const safeName = project.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "proyecto";

    const filename = `${safeName}-handoff.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/projects/[id]/handoff]", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
