import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { PHASE_SUBSTEPS } from "@/lib/phase-substeps";

/**
 * POST /api/projects/[id]/phases/[phaseId]/substep/[subStep]/rollback
 *
 * Rehacer una SUB-FASE concreta (Fase 3) en cascada, siguiendo la misma lógica
 * que el rollback de fase:
 *  - Conserva los sub-pasos ANTERIORES (subStepHistory con order < objetivo).
 *  - Resetea el sub-paso objetivo y los POSTERIORES (se borran del historial).
 *  - La fase vuelve a AVAILABLE posicionada en el sub-paso objetivo para
 *    rehacerlo; deja de estar COMPLETED y se limpian sus artifacts.
 *  - Resetea las fases POSTERIORES (sortOrder mayor) a LOCKED (dependían de la
 *    identidad que va a cambiar) e invalida el hand-off / skills generadas.
 *  - Cancela jobs en vuelo de las fases afectadas.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string; subStep: string }> }
) {
  try {
    const { id: projectId, phaseId, subStep } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
      select: { id: true, type: true, sortOrder: true, subStepHistory: true },
    });
    if (!phase) {
      return NextResponse.json({ error: "Fase no encontrada" }, { status: 404 });
    }

    const order = PHASE_SUBSTEPS[phase.type] || [];
    const target = order.find((s) => s.id === subStep);
    if (!target) {
      return NextResponse.json({ error: "Sub-paso no válido para esta fase" }, { status: 400 });
    }

    // Historial: conservar sub-pasos con order < objetivo; quitar el resto.
    const history =
      phase.subStepHistory && typeof phase.subStepHistory === "object" && !Array.isArray(phase.subStepHistory)
        ? (phase.subStepHistory as Record<string, { subStep?: string }>)
        : {};
    const keptHistory: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(history)) {
      const entry = order.find((s) => s.id === k);
      if (entry && entry.order < target.order) keptHistory[k] = v;
    }

    // Jobs en vuelo de las fases afectadas (objetivo + posteriores).
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ideaId: true },
    });
    const affected = await prisma.projectPhase.findMany({
      where: { projectId, sortOrder: { gte: phase.sortOrder } },
      select: { id: true },
    });
    const affectedIds = new Set(affected.map((p) => p.id));
    let jobIdsToCancel: string[] = [];
    if (project) {
      const activeJobs = await prisma.job.findMany({
        where: { ideaId: project.ideaId, status: { in: ["PENDING", "RUNNING"] } },
        select: { id: true, input: true },
      });
      jobIdsToCancel = activeJobs
        .filter((j) => {
          if (!j.input) return false;
          try {
            const p = JSON.parse(j.input) as { phaseId?: string };
            return typeof p.phaseId === "string" && affectedIds.has(p.phaseId);
          } catch {
            return false;
          }
        })
        .map((j) => j.id);
    }

    await prisma.$transaction(async (tx) => {
      // Fases POSTERIORES → LOCKED y limpias.
      await tx.projectPhase.updateMany({
        where: { projectId, sortOrder: { gt: phase.sortOrder } },
        data: {
          status: "LOCKED",
          artifacts: Prisma.JsonNull,
          questions: Prisma.JsonNull,
          subStep: null,
          subStepArtifact: Prisma.JsonNull,
          subStepChoice: null,
          subStepOrder: null,
          subStepHistory: Prisma.JsonNull,
          lastError: Prisma.JsonNull,
          completedAt: null,
        },
      });

      // Fase objetivo → AVAILABLE en el sub-paso objetivo, historial recortado.
      await tx.projectPhase.update({
        where: { id: phaseId },
        data: {
          status: "AVAILABLE",
          artifacts: Prisma.JsonNull,
          questions: Prisma.JsonNull,
          subStep: target.id,
          subStepOrder: target.order,
          subStepArtifact: Prisma.JsonNull,
          subStepChoice: null,
          subStepHistory:
            Object.keys(keptHistory).length > 0
              ? (keptHistory as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          lastError: Prisma.JsonNull,
          completedAt: null,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { handoffReady: false, generatedSkills: Prisma.JsonNull },
      });

      if (jobIdsToCancel.length > 0) {
        await tx.job.updateMany({
          where: { id: { in: jobIdsToCancel }, status: { in: ["PENDING", "RUNNING"] } },
          data: {
            status: "FAILED",
            error: "Job cancelado por rollback de sub-paso",
            finishedAt: new Date(),
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      targetSubStep: target.id,
      cancelledJobs: jobIdsToCancel.length,
    });
  } catch (error) {
    console.error("[POST .../substep/[subStep]/rollback]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
