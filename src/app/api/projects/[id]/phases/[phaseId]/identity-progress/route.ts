import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  IDENTITY_SUBSTEP_ORDER,
  getNextIdentitySubStep,
  getIdentitySubStepIndex,
} from "@/lib/identity-substeps";

/**
 * GET /api/projects/[id]/phases/[phaseId]/identity-progress
 *
 * Devuelve el estado del flujo multi-sub-step de la fase IDENTITY.
 *
 * Response shape:
 *   {
 *     current:  string | null  // sub-step activo (naming|voice|visual|final) o null si no ha empezado
 *     completed: string[]      // ids de sub-pasos ya confirmados por el usuario
 *     next:     string | null  // sub-step al que avanzará cuando confirme el actual (null = fase completada)
 *     isComplete: boolean      // true si la fase ya está COMPLETED
 *   }
 *
 * Sólo aplica a fases de tipo IDENTITY. Para otras fases devuelve 409.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }
    if (phase.type !== "IDENTITY") {
      return NextResponse.json(
        { error: "Phase is not of type IDENTITY" },
        { status: 409 }
      );
    }

    const isComplete = phase.status === "COMPLETED";
    const current = phase.subStep;

    // If the phase is complete, there is no current/next sub-step and
    // every sub-step is considered completed.
    if (isComplete) {
      return NextResponse.json({
        current: null,
        completed: IDENTITY_SUBSTEP_ORDER.map((s) => s.id),
        next: null,
        isComplete: true,
      });
    }

    // If the phase hasn't started a sub-step yet (status AVAILABLE / LOCKED
    // with no subStep), the current is null and the user is about to begin
    // with "naming".
    const next = getNextIdentitySubStep(current);
    const currentIndex = getIdentitySubStepIndex(current);
    const completed = IDENTITY_SUBSTEP_ORDER.slice(0, currentIndex).map(
      (s) => s.id
    );

    return NextResponse.json({
      current,
      completed,
      next,
      isComplete: false,
    });
  } catch (error) {
    console.error(
      "[GET /api/projects/[id]/phases/[phaseId]/identity-progress]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
