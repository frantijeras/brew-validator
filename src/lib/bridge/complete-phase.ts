import { prisma } from "@/lib/db";

/**
 * Completa una fase y desbloquea la siguiente (SIN auto-arrancarla).
 *
 *  1. Marca la fase como COMPLETED con el artefacto consolidado.
 *  2. Desbloquea (AVAILABLE) la fase inmediatamente posterior si seguía LOCKED.
 *
 * Por decisión de producto, NO se lanza el job de la siguiente fase: el usuario
 * la inicia manualmente con "Iniciar fase". Se usa cuando el usuario CONFIRMA
 * el último sub-paso de una fase con sub-pasos (p. ej. IDENTITY: elegir el
 * estilo visual cierra la fase, ya que no hay consolidación de Brand Book).
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

  await prisma.$transaction(async (tx) => {
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

  // Sin auto-arranque: la fase queda COMPLETED y la siguiente AVAILABLE. El
  // usuario inicia cada fase manualmente con "Iniciar fase".
}
