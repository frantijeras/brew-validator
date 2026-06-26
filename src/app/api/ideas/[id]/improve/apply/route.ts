import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { guardIdea } from "@/lib/ownership";
import { assertCanRefine, incrementRefinesUsed } from "@/lib/quota";
import {
  resolveModelForJobAgent,
  resolveThinkingForJobAgent,
} from "@/lib/agent-models";

const applySchema = z
  .object({
    // Respuestas del usuario a las preguntas generadas en el paso anterior.
    // Map { preguntaId | pregunta : respuesta }.
    answers: z.record(z.string(), z.string()),
  })
  .strict();

/**
 * POST /api/ideas/[id]/improve/apply — Segundo paso del flujo "Mejorar idea".
 * Con las respuestas del usuario, lanza el agente `idea-improver` en modo
 * "report" para que reescriba la idea (los 5 campos) a partir del veredicto, la
 * puntuación, el informe del juez y las respuestas.
 *
 * - Solo el dueño (guardIdea).
 * - Cuota de refinados (assertCanRefine): comprobación → 403 si está agotada.
 *   Se CONSUME aquí (un "Mejorar idea" cuenta como UN refinado).
 *
 * Marca la idea como IMPROVING (ocupada). El webhook, al COMPLETAR, aplica los
 * campos y RESETEA la validación (borra reports skeptic/advocate/judge, pone
 * verdict/score a null, validationStatus PENDING, status DRAFT) para que el
 * usuario pueda re-validar. Navigation-proof: sobrevive al cierre del navegador.
 * Devuelve `{ jobId }`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardIdea(id);
    if (!guard.ok) return guard.response;
    const userId = guard.userId;
    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos no válidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { answers } = parsed.data;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // Cuota de refinados (solo comprobación; admins exentos).
    const quota = await assertCanRefine(userId);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error }, { status: 403 });
    }

    // Informe del juez más reciente para esta idea.
    const judge = await prisma.report.findFirst({
      where: { ideaId: id, agentName: "judge" },
      orderBy: { createdAt: "desc" },
    });

    const input = {
      mode: "report" as const,
      ideaId: id,
      current: {
        title: idea.title,
        description: idea.description,
        problem: idea.problem || "",
        valueProposition: idea.valueProposition || "",
        targetUser: idea.targetUser,
        monetization: idea.monetization,
        businessModel: idea.businessModel || "",
      },
      verdict: idea.verdict,
      score: idea.score,
      judgeReport: judge?.content || "",
      answers,
      _bridgeModel: await resolveModelForJobAgent("idea-improver", userId),
      _thinking: await resolveThinkingForJobAgent("idea-improver", userId),
    };

    const job = await prisma.job.create({
      data: {
        ideaId: id,
        agentName: "idea-improver",
        status: "PENDING",
        input: JSON.stringify(input),
      },
    });

    // Marca la idea como ocupada (IMPROVING). El webhook la devuelve a DRAFT al
    // completar/fallar.
    await prisma.idea.update({
      where: { id },
      data: { status: "IMPROVING" },
    });

    // "Mejorar idea" cuenta como UN refinado (cuota vitalicia).
    await incrementRefinesUsed(userId);

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    console.error("[POST /api/ideas/:id/improve/apply]", error);
    return NextResponse.json(
      { error: "Error al aplicar la mejora" },
      { status: 500 }
    );
  }
}
