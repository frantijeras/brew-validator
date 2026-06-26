import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardIdea } from "@/lib/ownership";
import { assertCanRefine } from "@/lib/quota";
import {
  resolveModelForJobAgent,
  resolveThinkingForJobAgent,
} from "@/lib/agent-models";

/**
 * POST /api/ideas/[id]/improve/questions — Primer paso del flujo "Mejorar idea"
 * basado en el veredicto. Lanza el agente `idea-improver` en modo "questions"
 * para que, a partir del informe del juez + veredicto + puntuación, genere las
 * preguntas que ayudarán a mejorar la idea.
 *
 * - Solo el dueño (guardIdea).
 * - Solo DESPUÉS de validar: si la idea no está validada (validationStatus !=
 *   DONE), se rechaza con 409.
 * - Cuota de refinados (assertCanRefine): SOLO comprobación → 403 si está
 *   agotada. NO se consume aquí (se consume en /improve/apply).
 *
 * NO cambia el estado de la idea: generar preguntas no la deja "ocupada".
 * Devuelve `{ jobId }`. El output del job ({questions:[...]}) lo lee la UI vía
 * GET /api/jobs/[id].
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

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // Solo se puede mejorar una idea YA validada (con veredicto).
    if (idea.validationStatus !== "DONE") {
      return NextResponse.json(
        { error: "Valida la idea antes de mejorarla." },
        { status: 409 }
      );
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
      mode: "questions" as const,
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

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    console.error("[POST /api/ideas/:id/improve/questions]", error);
    return NextResponse.json(
      { error: "Error al iniciar la mejora" },
      { status: 500 }
    );
  }
}
