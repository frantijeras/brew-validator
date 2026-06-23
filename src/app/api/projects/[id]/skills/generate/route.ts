import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import type { ProjectMemory } from "@/lib/project-memory";
import type { GeneratedSkill } from "@/lib/skill-types";
import { buildProjectContext } from "@/lib/skill-context";
import { SKILL_CATALOG } from "@/lib/skill-catalog";
import { buildSkillMarkdown } from "@/lib/skill-templates";

const generateSkillsSchema = z.object({
  // Array vacío = "saltar": no genera nada, solo desbloquea el hand-off.
  skillIds: z.array(z.string()),
  // all → reemplaza; merge → upsert sólo skillIds; remove → quita skillIds.
  mode: z.enum(["all", "merge", "remove"]).default("all"),
});


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;
    const body = await req.json();
    const parsed = generateSkillsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { skillIds, mode } = parsed.data;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        idea: {
          select: {
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

    const existing: GeneratedSkill[] = Array.isArray(project.generatedSkills)
      ? (project.generatedSkills as unknown as GeneratedSkill[])
      : [];

    // ── mode "remove": quita las skillIds y persiste (sin generar) ──
    if (mode === "remove") {
      const remaining = existing.filter((g) => !skillIds.includes(g.id));
      await prisma.project.update({
        where: { id },
        data: {
          generatedSkills: remaining as unknown as Prisma.InputJsonValue,
          handoffReady: true,
        },
      });
      return NextResponse.json({ success: true, skills: remaining });
    }

    const ctx = buildProjectContext({
      name: project.name,
      description: project.description,
      idea: project.idea,
      phases: project.phases,
      memory: project.memory as ProjectMemory | null,
    });

    const generatedSkills: GeneratedSkill[] = skillIds.map((skillId) => {
      const def = SKILL_CATALOG.find((s) => s.id === skillId);
      return {
        id: skillId,
        name: def?.name || skillId,
        content: buildSkillMarkdown(skillId, ctx),
        source: "template" as const,
      };
    });

    // merge: upsert; all: reemplaza.
    let finalSkills: GeneratedSkill[];
    if (mode === "merge") {
      const byId = new Map(existing.map((g) => [g.id, g]));
      for (const g of generatedSkills) byId.set(g.id, g);
      finalSkills = Array.from(byId.values());
    } else {
      finalSkills = generatedSkills;
    }

    // Persiste también project.skills (meta del catálogo) para el AGENT.md del hand-off.
    const skillsMeta = finalSkills
      .map((g) => SKILL_CATALOG.find((s) => s.id === g.id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        icon: s.icon,
        category: s.category,
        selected: true,
      }));

    await prisma.project.update({
      where: { id },
      data: {
        generatedSkills: finalSkills as unknown as Prisma.InputJsonValue,
        skills: skillsMeta as unknown as Prisma.InputJsonValue,
        handoffReady: true,
      },
    });

    return NextResponse.json({ success: true, skills: finalSkills });
  } catch (error) {
    console.error("POST /api/projects/[id]/skills/generate error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
