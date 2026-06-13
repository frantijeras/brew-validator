import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { buildProjectContext } from "@/lib/skill-context";
import { resolveModelForJobAgent } from "@/lib/agent-models";
import { SKILL_CATALOG, getSkillOutputMeta } from "@/lib/skill-catalog";
import type { ProjectMemory } from "@/lib/project-memory";
import type { GeneratedSkill } from "@/lib/skill-types";

/**
 * POST /api/projects/[id]/skills/[skillId]/enhance
 *
 * Fase 2 (motor híbrido): mejora una skill con IA vía el Bridge. Encola un Job
 * (`agentName: "project-skills"`) con el contexto del proyecto + la skill. El
 * daemon lo ejecuta y postea el resultado a `/api/webhooks/skill-callback`, que
 * guarda el contenido en `generatedSkills[skill]` con `source: "ai"`.
 *
 * Marca de inmediato la skill como `source: "ai-pending"` para que la UI muestre
 * "Generando IA…" mientras tanto. Devuelve `{ jobId }` para que la UI sondee el
 * estado del job.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; skillId: string }> }
) {
  try {
    const { id: projectId, skillId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        idea: {
          select: {
            id: true,
            targetUser: true,
            valueProposition: true,
            problem: true,
            monetization: true,
            businessModel: true,
          },
        },
        phases: {
          orderBy: { sortOrder: "asc" },
          select: { label: true, type: true, status: true },
        },
      },
    });
    if (!project || !project.idea) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Nombre/descripción de la skill (catálogo o custom guardada).
    const catalog = SKILL_CATALOG.find((s) => s.id === skillId);
    const savedSkills = Array.isArray(project.skills)
      ? (project.skills as Array<{ id: string; name?: string; description?: string }>)
      : [];
    const savedSkill = savedSkills.find((s) => s.id === skillId);
    const skillName = catalog?.name || savedSkill?.name || skillId;
    const skillDescription = catalog?.description || savedSkill?.description || "";
    const meta = getSkillOutputMeta(skillId);

    const ctx = buildProjectContext({
      name: project.name,
      description: project.description,
      idea: project.idea,
      phases: project.phases,
      memory: project.memory as ProjectMemory | null,
    });

    const model = await resolveModelForJobAgent("project-skills");

    // Crea el Job para el daemon.
    const job = await prisma.job.create({
      data: {
        ideaId: project.idea.id,
        agentName: "project-skills",
        status: "PENDING",
        input: JSON.stringify({
          projectId,
          skillId,
          skillName,
          skillDescription,
          outputMeta: meta,
          context: ctx,
          _bridgeModel: model,
        }),
      },
      select: { id: true },
    });

    // Marca la skill como "generando IA" en generatedSkills (upsert).
    const existing: GeneratedSkill[] = Array.isArray(project.generatedSkills)
      ? (project.generatedSkills as unknown as GeneratedSkill[])
      : [];
    const byId = new Map(existing.map((g) => [g.id, g]));
    const prev = byId.get(skillId);
    byId.set(skillId, {
      id: skillId,
      name: skillName,
      content: prev?.content || "",
      source: "ai-pending",
    });
    await prisma.project.update({
      where: { id: projectId },
      data: {
        generatedSkills: Array.from(byId.values()) as unknown as Prisma.InputJsonValue,
        handoffReady: true,
      },
    });

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error) {
    console.error("[POST /skills/[skillId]/enhance]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
