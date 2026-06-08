import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { inferSkills } from "@/lib/skill-inference";
import type { InferenceInput, SkillRecommendation } from "@/lib/skill-inference";

const savedSkillSchema = z.object({
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
});

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

    // Sort by confidence descending
    recommendations.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({ skills: recommendations });
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
        { error: "Datos invalidos", details: parsed.error.flatten() },
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
