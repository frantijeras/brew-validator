import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardPhase } from "@/lib/ownership";

export async function POST(req: Request) {
  try {
    const { phaseId } = await req.json();
    if (!phaseId) {
      return NextResponse.json({ error: "Missing phaseId" }, { status: 400 });
    }

    const guard = await guardPhase(phaseId);
    if (!guard.ok) return guard.response;

    const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }

    // Only allow cancel if in PROCESSING, QUESTIONING or SUBSTEP_READY state
    if (
      phase.status !== "PROCESSING" &&
      phase.status !== "QUESTIONING" &&
      phase.status !== "SUBSTEP_READY"
    ) {
      return NextResponse.json({ error: "Phase is not in a cancellable state" }, { status: 409 });
    }

    // Update phase: reset to AVAILABLE, clear any stored questions/artifact.
    // Json fields need Prisma.JsonNull — `undefined` is ignored by Prisma.
    await prisma.projectPhase.update({
      where: { id: phaseId },
      data: {
        status: "AVAILABLE",
        questions: Prisma.JsonNull,
        answers: Prisma.JsonNull,
        subStepArtifact: Prisma.JsonNull,
        subStepChoice: null,
      },
    });

    // Marca como CANCELLED los jobs aún en vuelo de esta fase (su phaseId va en
    // job.input). Evita jobs huérfanos PENDING/RUNNING; un callback tardío se
    // ignora por idempotencia.
    await prisma.job.updateMany({
      where: {
        status: { in: ["PENDING", "RUNNING"] },
        input: { contains: phaseId },
      },
      data: {
        status: "CANCELLED",
        error: "Cancelado por el usuario",
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "Fase cancelada y disponible de nuevo" });
  } catch (error) {
    console.error("[POST /api/projects/cancel-phase]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
