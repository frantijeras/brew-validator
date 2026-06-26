import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardIdea } from "@/lib/ownership";

/**
 * POST /api/ideas/[id]/improve/cancel — Cancela el flujo "Mejorar idea" y
 * desbloquea la idea (sale de IMPROVING). Pensado para que el usuario pueda
 * abortar la mejora mientras está GENERANDO preguntas o en el QUIZ.
 *
 * Solo el dueño (guardIdea). NO se permite cuando ya se está APLICANDO (hay un
 * job del mejorador en modo "report" PENDING/RUNNING): en esa fase la mejora ya
 * consumió cuota y está reescribiendo la idea, así que no se puede cancelar.
 *
 * Efecto: marca CANCELLED los jobs PENDING/RUNNING del mejorador para esta idea
 * y devuelve la idea a un estado no-busy (COMPLETED si validationStatus DONE,
 * DRAFT en caso contrario). No hay reembolso de cuota: el apply aún no consumió
 * (la cuota se consume en /improve/apply).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const guard = await guardIdea(id);
    if (!guard.ok) return guard.response;

    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: "Idea no encontrada" }, { status: 404 });
    }

    // ¿Se está APLICANDO ya? (job del mejorador en modo "report" en curso). En
    // ese caso no se puede cancelar: la cuota ya se consumió y se está
    // reescribiendo la idea.
    const inFlight = await prisma.job.findMany({
      where: {
        ideaId: id,
        agentName: "idea-improver",
        status: { in: ["PENDING", "RUNNING"] },
      },
    });
    const applying = inFlight.some((j) => {
      try {
        return (JSON.parse(j.input || "{}") as { mode?: unknown }).mode === "report";
      } catch {
        return false;
      }
    });
    if (applying) {
      return NextResponse.json(
        { error: "No se puede cancelar mientras se aplica la mejora." },
        { status: 409 }
      );
    }

    const nextStatus = idea.validationStatus === "DONE" ? "COMPLETED" : "DRAFT";

    await prisma.$transaction([
      prisma.job.updateMany({
        where: {
          ideaId: id,
          agentName: "idea-improver",
          status: { in: ["PENDING", "RUNNING"] },
        },
        data: { status: "CANCELLED" },
      }),
      prisma.idea.update({
        where: { id },
        data: { status: nextStatus },
      }),
    ]);

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error("[POST /api/ideas/:id/improve/cancel]", error);
    return NextResponse.json(
      { error: "Error al cancelar la mejora" },
      { status: 500 }
    );
  }
}
