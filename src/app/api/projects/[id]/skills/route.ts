import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { assertCanAccessSkills } from "@/lib/quota";
import { SKILL_CATALOG } from "@/lib/skill-catalog";
import type { SkillData } from "@/lib/skill-types";

/**
 * GET /api/projects/[id]/skills
 *
 * Sin motor de recomendación: devuelve el conjunto FIJO de skills del catálogo
 * (todas) en forma plana `SkillData`, más las skills ya generadas
 * (`generated`) para la lista de revisión de la UI.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;

    // Gate de Skills (admin o flag canAccessSkills).
    const gate = await assertCanAccessSkills(guard.userId as string);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, generatedSkills: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const skills: SkillData[] = SKILL_CATALOG.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      icon: s.icon,
      category: s.category,
      selected: true,
    }));

    const generated = Array.isArray(project.generatedSkills)
      ? project.generatedSkills
      : [];

    return NextResponse.json({ skills, generated });
  } catch (error) {
    console.error("GET /api/projects/[id]/skills error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
