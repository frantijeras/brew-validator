import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";

/**
 * POST /api/projects/[id]/phases/[phaseId]/rollback
 *
 * Rollback (Regresión en cascada): el usuario decide REHACER una fase
 * anterior. Cuando esto ocurre, todos los artefactos, estados e informes de
 * las fases POSTERIORES dejan de ser válidos (se generaron a partir de una
 * versión de la fase objetivo que va a cambiar). Esta ruta:
 *
 *   1. Carga la fase objetivo (phaseId) y su `sortOrder` dentro del proyecto.
 *   2. Para TODAS las fases del proyecto con `sortOrder` > objetivo: las
 *      resetea a LOCKED (Bloqueada) y limpia todo su estado/artefactos.
 *   3. La fase objetivo vuelve a AVAILABLE (Disponible) limpiando su estado
 *      intermedio para que el usuario la rehaga desde cero.
 *   4. Si el proyecto tenía `handoffReady` (Entrega lista) = true o
 *      `generatedSkills` (Habilidades generadas), se invalidan: las fases
 *      posteriores ya no son válidas, así que el hand-off tampoco.
 *   5. Cancela (best-effort) los jobs (Trabajos) PENDING/RUNNING asociados a
 *      las fases purgadas, marcándolos como FAILED.
 *
 * Toda la mutación de la BDD (Base de datos) se hace dentro de una única
 * transacción `prisma.$transaction` para que sea atómica: o se aplica el
 * rollback completo o nada (evita estados a medias).
 *
 * El "Storage" (Almacenamiento) de artefactos en este proyecto es Json en la
 * propia BDD (no hay bucket/fichero externo), por lo que limpiar los campos
 * Json purga también el almacenamiento.
 *
 * SEGURIDAD: la ruta es autenticada y verifica ownership (propiedad) del
 * proyecto vía `guardProject`. Las consultas SIEMPRE filtran por `projectId`
 * y por `sortOrder` > objetivo, de modo que es imposible tocar fases
 * ANTERIORES, la propia fase objetivo (que se trata aparte) ni fases de OTROS
 * proyectos.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;

    // Auth + ownership: solo el dueño del proyecto puede hacer rollback.
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    // 1. Cargar la fase objetivo. Filtramos por projectId para confirmar que
    // la fase pertenece a ESTE proyecto (no a otro).
    const targetPhase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
      select: { id: true, sortOrder: true },
    });
    if (!targetPhase) {
      return NextResponse.json(
        { error: "Fase no encontrada en este proyecto" },
        { status: 404 }
      );
    }

    const targetSortOrder = targetPhase.sortOrder;

    // Identificar los jobs en vuelo (PENDING/RUNNING) de las fases que vamos a
    // purgar (objetivo + posteriores) ANTES de la transacción. Los jobs
    // referencian projectId/phaseId dentro de `job.input` (JSON serializado),
    // así que cargamos los jobs activos del proyecto (vía ideaId) y filtramos
    // en memoria por phaseId. Es best-effort: si `input` no es JSON válido, lo
    // ignoramos sin abortar el rollback.
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ideaId: true },
    });

    // Conjunto de fases afectadas (objetivo incluido) para el filtrado de jobs.
    const affectedPhases = await prisma.projectPhase.findMany({
      where: { projectId, sortOrder: { gte: targetSortOrder } },
      select: { id: true },
    });
    const affectedPhaseIds = new Set(affectedPhases.map((p) => p.id));

    let jobIdsToCancel: string[] = [];
    if (project) {
      const activeJobs = await prisma.job.findMany({
        where: { ideaId: project.ideaId, status: { in: ["PENDING", "RUNNING"] } },
        select: { id: true, input: true },
      });
      jobIdsToCancel = activeJobs
        .filter((job) => {
          if (!job.input) return false;
          try {
            const parsed = JSON.parse(job.input) as { phaseId?: string };
            return typeof parsed.phaseId === "string" && affectedPhaseIds.has(parsed.phaseId);
          } catch {
            return false;
          }
        })
        .map((job) => job.id);
    }

    // Mutación atómica.
    await prisma.$transaction(async (tx) => {
      // 2. Fases POSTERIORES (sortOrder > objetivo): resetear a LOCKED y limpiar
      // TODO su estado/artefactos. `updateMany` con el filtro
      // `sortOrder > targetSortOrder` garantiza que nunca tocamos fases
      // anteriores ni la propia objetivo. Los campos Json deben usar
      // `Prisma.JsonNull` (un `null` JS sería ignorado por Prisma).
      await tx.projectPhase.updateMany({
        where: { projectId, sortOrder: { gt: targetSortOrder } },
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

      // 3. Fase OBJETIVO: vuelve a AVAILABLE limpiando su estado intermedio.
      // DECISIÓN: al "rehacer" la fase X también limpiamos sus `artifacts`
      // (y demás campos), para que el usuario la rehaga DESDE CERO con estado
      // limpio (es lo que pide el spec por defecto). Si en el futuro se quisiera
      // conservar el informe previo de la fase objetivo, bastaría con no incluir
      // `artifacts` aquí.
      await tx.projectPhase.update({
        where: { id: phaseId },
        data: {
          status: "AVAILABLE",
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

      // 4. Invalidar hand-off (Entrega) y skills generadas: dependen de fases
      // posteriores que ya no son válidas.
      await tx.project.update({
        where: { id: projectId },
        data: {
          handoffReady: false,
          generatedSkills: Prisma.JsonNull,
        },
      });

      // 5. Cancelar jobs PENDING/RUNNING de las fases purgadas: los marcamos
      // como FAILED para que el webhook de callback los ignore (es idempotente
      // ante jobs terminales) y no resuciten una fase ya reseteada. Best-effort:
      // si el bridge ya estaba procesando uno, su callback se descartará al ver
      // el job en estado terminal.
      if (jobIdsToCancel.length > 0) {
        await tx.job.updateMany({
          where: { id: { in: jobIdsToCancel }, status: { in: ["PENDING", "RUNNING"] } },
          data: {
            status: "FAILED",
            error: "Job cancelado por rollback (regresión en cascada) de la fase",
            finishedAt: new Date(),
          },
        });
      }
    });

    // Devolver el nuevo estado de las fases (orden por sortOrder) para que el
    // frontend pueda purgar/invalidar su estado y re-renderizar sin "datos
    // fantasma".
    const phases = await prisma.projectPhase.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        type: true,
        label: true,
        status: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Rollback aplicado: fases posteriores purgadas y fase objetivo lista para rehacer",
      targetPhaseId: phaseId,
      cancelledJobs: jobIdsToCancel.length,
      phases,
    });
  } catch (error) {
    console.error(
      "[POST /api/projects/[id]/phases/[phaseId]/rollback]",
      error
    );
    // No exponemos `error.message` al cliente (podría filtrar detalle interno
    // de la BDD); el detalle queda en el log del servidor. Mensaje genérico.
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
