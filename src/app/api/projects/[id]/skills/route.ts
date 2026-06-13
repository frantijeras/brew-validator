import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { inferSkills } from "@/lib/skill-inference";
import type { InferenceInput } from "@/lib/skill-inference";
import type { SkillData } from "@/lib/skill-types";

const savedSkillSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    category: z.enum([
      "desarrollo",
      "marketing",
      "operaciones",
      "legal",
      "finanzas",
    ]),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
    recommended: z.boolean(),
    selected: z.boolean(),
    custom: z.boolean(),
    matchedConditions: z.array(z.string()).optional(),
  })
  .passthrough();

const putBodySchema = z.object({
  skills: z.array(savedSkillSchema),
});

/**
 * GET /api/projects/[id]/skills
 *
 * Carga el proyecto con todas las fases completadas,
 * ejecuta el motor de inferencia y devuelve las recomendaciones
 * (sin persistir).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        idea: {
          select: {
            businessModel: true,
          },
        },
        phases: {
          where: { status: "COMPLETED" },
          orderBy: { sortOrder: "asc" },
          // Only the fields the inference loop reads below.
          select: {
            type: true,
            artifacts: true,
            questions: true,
            subStepChoice: true,
            subStepArtifact: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    // Build InferenceInput matching the DB shape directly
    const phaseArtifacts: InferenceInput["phaseArtifacts"] = [];
    const phaseQuizAnswers: InferenceInput["phaseQuizAnswers"] = [];

    for (const phase of project.phases) {
      // Map DB artifacts → spec shape
      const artifactsData = phase.artifacts as
        | Array<{ title?: string; content?: string }>
        | null;

      phaseArtifacts.push({
        type: phase.type,
        artifacts: artifactsData ?? [],
      });

      // Map DB questions → spec shape
      const questionsData = phase.questions as
        | Array<{
            id: string;
            label?: string;
            type?: string;
          }>
        | null;

      const subStepChoice = phase.subStepChoice;
      const ssa = phase.subStepArtifact as
        | {
            type?: string;
            content?: string;
            options?: Array<{ value: string; label: string }>;
          }
        | null;

      // Build question objects with resolved answers
      const enrichedQuestions: Array<{
        id: string;
        answer?: string;
        options?: Array<{ value: string; label: string }>;
      }> = [];

      if (questionsData) {
        for (const q of questionsData) {
          let answer: string | undefined;

          // Try to resolve answer from subStepChoice + options
          if (subStepChoice && ssa?.options) {
            const selected = ssa.options.find(
              (opt) => opt.value === subStepChoice,
            );
            if (selected) {
              answer = selected.label || selected.value;
            }
          }

          if (!answer && subStepChoice) {
            answer = subStepChoice;
          }

          enrichedQuestions.push({
            id: q.id,
            answer,
            options: ssa?.options,
          });
        }
      }

      phaseQuizAnswers.push({
        type: phase.type,
        questions: enrichedQuestions.length > 0 ? enrichedQuestions : null,
      });
    }

    const inferenceInput: InferenceInput = {
      businessModel: project.idea.businessModel,
      phaseArtifacts,
      phaseQuizAnswers,
      projectMemory: project.memory as Record<string, unknown> | null,
    };

    const recommendations = inferSkills(inferenceInput);

    // ── APLANAR a SkillData + FUSIONAR con la selección guardada ──
    // El motor devuelve `SkillRecommendation` anidado; la UI/PUT usan la forma
    // PLANA `SkillData`. Aplanamos y respetamos `selected` previo (persistencia)
    // y añadimos las skills `custom` que el usuario ya guardó.
    const saved = (Array.isArray(project.skills)
      ? (project.skills as unknown as SkillData[])
      : []
    ).filter((s) => s && typeof s.id === "string");
    const savedById = new Map(saved.map((s) => [s.id, s]));

    const flat: SkillData[] = recommendations.map((r) => {
      const prev = savedById.get(r.skill.id);
      return {
        id: r.skill.id,
        name: r.skill.name,
        description: r.skill.description,
        icon: r.skill.icon,
        category: r.skill.category,
        confidence: r.confidence,
        reason: r.reason,
        recommended: r.recommended,
        matchedConditions: r.matchedConditions,
        // Selección: respeta lo guardado; por defecto, recomendadas fuertes.
        selected: prev ? prev.selected === true : r.recommended && r.confidence >= 0.7,
        custom: false,
      };
    });

    // Skills custom guardadas (no están en el catálogo) → se conservan.
    const catalogIds = new Set(recommendations.map((r) => r.skill.id));
    const customSaved = saved.filter((s) => s.custom && !catalogIds.has(s.id));

    const result = [...flat, ...customSaved].sort(
      (a, b) => b.confidence - a.confidence
    );

    // Skills ya generadas (contenido) para la lista de revisión de la UI.
    const generated = Array.isArray(project.generatedSkills)
      ? project.generatedSkills
      : [];

    return NextResponse.json({ skills: result, generated });
  } catch (error) {
    console.error("GET /api/projects/[id]/skills error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/projects/[id]/skills
 *
 * Guarda la seleccion de skills del usuario en project.skills.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const guard = await guardProject(id);
    if (!guard.ok) return guard.response;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const parsed = putBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        skills: parsed.data.skills as unknown as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        skills: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      skills: updated.skills,
    });
  } catch (error) {
    console.error("PUT /api/projects/[id]/skills error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
