import { prisma } from "@/lib/db";
import { enqueuePhaseJob } from "@/lib/bridge/phase-jobs";

/**
 * Completa una fase y arranca automáticamente la siguiente.
 *
 * Reúne en un único sitio la lógica de cierre + auto-arranque que también usa
 * el webhook `project-phase-callback`:
 *  1. Marca la fase como COMPLETED con el artefacto consolidado.
 *  2. Desbloquea (AVAILABLE) la fase inmediatamente posterior si seguía LOCKED.
 *  3. Si la acabamos de desbloquear nosotros, lanza su quiz (mode "questions")
 *     para que el flujo continúe sin clic manual.
 *
 * Se usa cuando el usuario CONFIRMA el último sub-paso de una fase con
 * sub-pasos (p. ej. IDENTITY: elegir el estilo visual 3d cierra la fase, ya
 * que no existe consolidación de Brand Book). Un fallo en el auto-arranque no
 * propaga: la fase ya quedó COMPLETED y la siguiente AVAILABLE como fallback.
 */
export async function completePhaseAndAutostart(params: {
  projectId: string;
  phaseId: string;
  artifact: { title: string; content: string; type: string };
  /** subStep final con el que se cierra (se persiste en la fila). */
  subStep?: string | null;
}): Promise<void> {
  const { projectId, phaseId, artifact, subStep } = params;

  const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
  if (!phase) return;

  const unlocked = await prisma.$transaction(async (tx) => {
    await tx.projectPhase.update({
      where: { id: phaseId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        subStep: subStep ?? phase.subStep,
        artifacts: [artifact],
      },
    });
    return tx.projectPhase.updateMany({
      where: { projectId, sortOrder: phase.sortOrder + 1, status: "LOCKED" },
      data: { status: "AVAILABLE" },
    });
  });

  if (unlocked.count === 1) {
    try {
      const next = await prisma.projectPhase.findFirst({
        where: { projectId, sortOrder: phase.sortOrder + 1 },
      });
      if (next && next.status === "AVAILABLE") {
        await enqueuePhaseJob({
          projectId,
          phaseId: next.id,
          phaseType: next.type,
          mode: "questions",
        });
      }
    } catch (autoErr) {
      console.error(
        `[completePhaseAndAutostart] auto-start de la siguiente fase falló (projectId=${projectId}, tras phase ${phaseId}):`,
        autoErr
      );
    }
  }
}
