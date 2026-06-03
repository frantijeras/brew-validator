import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// ── Schema: manual mode with structured fields ──
const manualFieldsSchema = z.object({
  mode: z.literal("manual"),
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  problem: z.string().optional(),
  valueProposition: z.string().optional(),
  targetUser: z.string().min(3).optional(),
  monetization: z.string().min(3).optional(),
});

// ── Schema: manual mode with raw text ──
const manualRawSchema = z.object({
  mode: z.literal("manual"),
  rawText: z.string().min(10, "El texto debe tener al menos 10 caracteres"),
});

// ── Schema: quiz mode (fase 1 — sin answers) ──
const quizStartSchema = z.object({
  mode: z.literal("quiz"),
});

// ── Schema: quiz mode (fase 2 — con answers) ──
const quizAnswersSchema = z.object({
  mode: z.literal("quiz"),
  answers: z.array(
    z.object({
      questionId: z.string(),
      questionText: z.string(),
      answer: z.string(),
    })
  ).min(1, "Debe incluir al menos una respuesta"),
});

const refineSchema = z.union([
  manualFieldsSchema,
  manualRawSchema,
  quizAnswersSchema,
  quizStartSchema,
]);

const REFINER_AGENT = "brew-qa-refiner";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;
    const body = await req.json();
    const parsed = refineSchema.parse(body);

    // Find the idea
    const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // ── Manual mode (structured fields) ──
    if (parsed.mode === "manual" && !("rawText" in parsed)) {
      return handleManualMode(idea, parsed);
    }

    // ── Manual mode (raw text) ──
    if (parsed.mode === "manual" && "rawText" in parsed) {
      return handleManualRawMode(idea, parsed);
    }

    // ── Quiz mode (fase 1 — sin answers → crear job) ──
    if (parsed.mode === "quiz" && !("answers" in parsed)) {
      return handleQuizPhase1(idea);
    }

    // ── Quiz mode (fase 2 — con answers → reabrir job) ──
    if (parsed.mode === "quiz" && "answers" in parsed) {
      return handleQuizPhase2(idea, parsed);
    }

    return NextResponse.json({ error: "Modo no soportado" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    console.error("[POST /api/ideas/:id/refine]", error);
    return NextResponse.json(
      { error: "Error al procesar el refinamiento" },
      { status: 500 }
    );
  }
}

// ── Manual mode (structured fields): update idea directly + save IdeaVersion ──
async function handleManualMode(
  idea: { id: string; title: string; description: string; problem: string | null; valueProposition: string | null; targetUser: string; monetization: string },
  input: z.infer<typeof manualFieldsSchema>
) {
  const updateData: Record<string, unknown> = {};

  if (input.title) updateData.title = input.title;
  if (input.description) updateData.description = input.description;
  if (input.problem !== undefined) updateData.problem = input.problem;
  if (input.valueProposition !== undefined) updateData.valueProposition = input.valueProposition;
  if (input.targetUser) updateData.targetUser = input.targetUser;
  if (input.monetization) updateData.monetization = input.monetization;

  // Only update if there are actual changes
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  // Save previous version
  await prisma.ideaVersion.create({
    data: {
      ideaId: idea.id,
      title: idea.title,
      description: idea.description,
      targetUser: idea.targetUser,
      monetization: idea.monetization,
      phase: "pre-validation",
    },
  });

  // Update the idea
  const updated = await prisma.idea.update({
    where: { id: idea.id },
    data: updateData,
  });

  return NextResponse.json({ success: true, idea: updated });
}

// ── Manual mode (raw text): update description + save IdeaVersion ──
async function handleManualRawMode(
  idea: { id: string; title: string; description: string; problem: string | null; valueProposition: string | null; targetUser: string; monetization: string },
  input: z.infer<typeof manualRawSchema>
) {
  // Save previous version
  await prisma.ideaVersion.create({
    data: {
      ideaId: idea.id,
      title: idea.title,
      description: idea.description,
      targetUser: idea.targetUser,
      monetization: idea.monetization,
      phase: "pre-validation",
    },
  });

  // Update the idea with the raw text as new description
  const updated = await prisma.idea.update({
    where: { id: idea.id },
    data: {
      description: input.rawText.trim(),
    },
  });

  return NextResponse.json({ success: true, idea: updated });
}

// ── Quiz Phase 1: Create job to generate all questions ──
async function handleQuizPhase1(
  idea: { id: string; title: string; description: string; problem: string | null; valueProposition: string | null; targetUser: string; monetization: string }
) {
  const jobInput = {
    idea: {
      title: idea.title,
      description: idea.description,
      problem: idea.problem,
      valueProposition: idea.valueProposition,
      targetUser: idea.targetUser,
      monetization: idea.monetization,
    },
    mode: "quiz" as const,
    answers: [],
  };

  const job = await prisma.job.create({
    data: {
      ideaId: idea.id,
      agentName: REFINER_AGENT,
      status: "PENDING",
      input: JSON.stringify(jobInput),
    },
  });

  return NextResponse.json({
    status: "PENDING",
    jobId: job.id,
  });
}

// ── Quiz Phase 2: Submit answers, re-trigger job → DONE ──
async function handleQuizPhase2(
  idea: { id: string; title: string; description: string; problem: string | null; valueProposition: string | null; targetUser: string; monetization: string },
  input: z.infer<typeof quizAnswersSchema>
) {
  const jobInput = {
    idea: {
      title: idea.title,
      description: idea.description,
      problem: idea.problem,
      valueProposition: idea.valueProposition,
      targetUser: idea.targetUser,
      monetization: idea.monetization,
    },
    mode: "quiz" as const,
    answers: input.answers,
  };

  // Create a new job for phase 2 (with answers)
  const job = await prisma.job.create({
    data: {
      ideaId: idea.id,
      agentName: REFINER_AGENT,
      status: "PENDING",
      input: JSON.stringify(jobInput),
    },
  });

  return NextResponse.json({
    status: "PENDING",
    jobId: job.id,
  });
}

// ── GET: poll job status ──
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ideaId } = await params;
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json({ error: "jobId requerido" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    let outputData: Record<string, unknown> = {};
    try {
      if (job.output) {
        outputData = JSON.parse(job.output);
      }
    } catch {
      // output not valid JSON yet
    }

    // ── QUESTIONS_READY: bridge generated all questions ──
    if (outputData.status === "QUESTIONS_READY") {
      return NextResponse.json({
        status: "QUESTIONS_READY",
        questions: outputData.questions || [],
        jobId: job.id,
      });
    }

    // ── DONE: refined idea ──
    if (outputData.status === "DONE") {
      return NextResponse.json({
        status: "DONE",
        message: outputData.summary || "Refinamiento completado",
        summary: outputData.summary,
        title: outputData.title,
        description: outputData.description,
        problem: outputData.problem,
        valueProposition: outputData.valueProposition,
        targetUser: outputData.targetUser,
        monetization: outputData.monetization,
        jobId: job.id,
      });
    }

    // ── Still processing ──
    if (job.status === "RUNNING" || job.status === "PENDING") {
      return NextResponse.json({
        status: job.status,
        message: "Procesando...",
        jobId: job.id,
      });
    }

    // ── Failed ──
    if (job.status === "FAILED") {
      return NextResponse.json({
        status: "FAILED",
        message: job.error || "Error en el refinamiento",
        jobId: job.id,
      });
    }

    return NextResponse.json({
      status: job.status,
      jobId: job.id,
    });
  } catch (error) {
    console.error("[GET /api/ideas/:id/refine]", error);
    return NextResponse.json(
      { error: "Error al consultar el refinamiento" },
      { status: 500 }
    );
  }
}
