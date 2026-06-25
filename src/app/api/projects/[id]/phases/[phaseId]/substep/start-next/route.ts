import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { enqueuePhaseJob } from "@/lib/bridge/phase-jobs";
import { PHASE_SUBSTEPS } from "@/lib/phase-substeps";

/**
 * POST /api/projects/[id]/phases/[phaseId]/substep/start-next
 *
 * Arranque MANUAL del siguiente sub-paso de IDENTITY. Antes, confirmar un
 * sub-paso intermedio en /substep/choose encolaba automáticamente el siguiente;
 * ahora /substep/choose deja la fase en `SUBSTEP_PENDING` y es el USUARIO quien
 * pulsa "Iniciar <siguiente sub-paso>", que llega aquí.
 *
 * Requiere `status === "SUBSTEP_PENDING"` (409 en otro caso). Calcula el
 * siguiente sub-paso desde el `phase.subStep` ACTUAL (el recién confirmado)
 * usando PHASE_SUBSTEPS — misma lógica que /substep/choose — y encola el job.
 *
 * Status: SUBSTEP_PENDING → PROCESSING.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }
    if (phase.status !== "SUBSTEP_PENDING") {
      return NextResponse.json(
        { error: "Phase is not in SUBSTEP_PENDING state" },
        { status: 409 }
      );
    }

    // Calcular el siguiente sub-paso desde la posición actual (misma lógica
    // que /substep/choose).
    let nextSubStepName: string | undefined;
    const substeps = PHASE_SUBSTEPS[phase.type];
    if (substeps && phase.subStep) {
      const currentIdx = substeps.findIndex((s) => s.id === phase.subStep);
      if (currentIdx >= 0 && currentIdx < substeps.length - 1) {
        nextSubStepName = substeps[currentIdx + 1].id;
      }
    }

    if (!nextSubStepName) {
      // No debería ocurrir: el último sub-paso cierra la fase en /substep/choose
      // y nunca deja la fase en SUBSTEP_PENDING.
      return NextResponse.json(
        { error: "No hay un siguiente sub-paso que iniciar" },
        { status: 400 }
      );
    }

    const result = await enqueuePhaseJob({
      projectId,
      phaseId,
      phaseType: phase.type,
      mode: "report",
      subStep: nextSubStepName,
      answers: { subStepChoice: phase.subStepChoice || "" },
      includePreviousSubStepArtifact: true,
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      subStep: result.subStep,
    });
  } catch (error) {
    console.error(
      "[POST /api/projects/[id]/phases/[phaseId]/substep/start-next]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
