import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardProject } from "@/lib/ownership";
import { completePhaseAndAutostart } from "@/lib/bridge/complete-phase";
import { PHASE_SUBSTEPS } from "@/lib/phase-substeps";
import { buildIdentitySummaryMarkdown } from "@/lib/identity-summary";
import {
  mergeProjectMemory,
  type MemorySource,
  type MemoryEntry,
  type ProjectMemory,
} from "@/lib/project-memory";

/**
 * Consolida en `Project.memory` la decisión que cierra un sub-paso de identidad
 * confirmado por el usuario, para que las fases posteriores no la repregunten:
 *  - naming → `brandName` (el nombre elegido)
 *  - voice  → `tone` (la voz/tono elegido)
 * El sub-paso `visual` no se consolida aquí (la elección es solo la variante
 * A/B/C); la identidad visual se materializa en los assets 3d.
 */
async function recordIdentityDecision(
  projectId: string,
  sortOrder: number,
  subStepId: string,
  choice: string,
): Promise<void> {
  const topic =
    subStepId === "naming" ? "brandName" : subStepId === "voice" ? "tone" : null;
  if (!topic) return;
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { memory: true },
    });
    const current = (project?.memory as ProjectMemory | null) ?? {};
    const source = String(Math.min(Math.max(sortOrder, 0), 6)).padStart(
      2,
      "0",
    ) as MemorySource;
    const entry: MemoryEntry = {
      value: choice,
      source,
      updatedAt: new Date().toISOString(),
    };
    const merged = mergeProjectMemory(current, { [topic]: entry }, source);
    await prisma.project.update({
      where: { id: projectId },
      data: { memory: merged as unknown as Prisma.InputJsonValue },
    });
  } catch (e) {
    console.error(
      `[substep/choose] no se pudo consolidar la decisión "${subStepId}" (projectId=${projectId}):`,
      e,
    );
  }
}

/**
 * POST /api/projects/[id]/phases/[phaseId]/substep/choose
 *
 * El usuario eligió (A/B/C o nombre custom) en el modal de sub-step.
 *
 * Sub-paso NO final: registra la elección (subStepChoice + subStepHistory) y
 * PAUSA la fase en `SUBSTEP_PENDING` SIN encolar nada. El usuario arranca
 * manualmente el siguiente sub-paso con el botón "Iniciar <siguiente>" que
 * llama a POST /substep/start-next. Status: SUBSTEP_READY → SUBSTEP_PENDING.
 *
 * Sub-paso final: cierra la fase vía `completePhaseAndAutostart` (que ya NO
 * auto-arranca la siguiente FASE).
 *
 * Flujo IDENTITY: naming → voice → logo → visual → (fase completada).
 *
 * Body:
 *   { choice: string, nextSubStep?: "naming"|"voice"|"logo"|"visual" }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const { id: projectId, phaseId } = await params;
    const guard = await guardProject(projectId);
    if (!guard.ok) return guard.response;
    const { choice, nextSubStep } = await req.json();

    if (!choice || typeof choice !== "string") {
      return NextResponse.json({ error: "Missing choice" }, { status: 400 });
    }

    const phase = await prisma.projectPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) {
      return NextResponse.json({ error: "Phase not found" }, { status: 404 });
    }
    if (phase.status !== "SUBSTEP_READY") {
      return NextResponse.json(
        { error: "Phase is not in SUBSTEP_READY state" },
        { status: 409 }
      );
    }

    // Sub-steps whose choice is a free identifier (mirrors FREE_INPUT_SUBSTEPS
    // in the modal): "naming" (custom name allowed), "logo" (chosen logo id of
    // 1..12) and "visual" (chosen variant A/B/C — options live inside the HTML
    // artifact, not as a top-level options array). For sub-steps that DO expose
    // a top-level options array, the choice must match one of them.
    const FREE_INPUT_SUBSTEPS = new Set(["naming", "logo", "visual"]);
    const currentSubStep = phase.subStep || "";
    if (!FREE_INPUT_SUBSTEPS.has(currentSubStep)) {
      const artifact = phase.subStepArtifact as {
        options?: Array<{ value?: unknown; label?: unknown }>;
      } | null;
      const opts = Array.isArray(artifact?.options) ? artifact.options : null;
      if (opts && opts.length > 0) {
        const isValid = opts.some(
          (o) => o?.value === choice || o?.label === choice
        );
        if (!isValid) {
          return NextResponse.json(
            { error: "La elección no corresponde a ninguna de las opciones generadas" },
            { status: 400 }
          );
        }
      }
    }

    // Accumulate the confirmed sub-step into `subStepHistory` so each sub-step
    // (naming / voice / logo / visual) is preserved independently. The singular
    // `subStepArtifact`/`subStepChoice` fields hold only the *current* sub-step
    // and get overwritten by the next one — the history is what the 3d composition
    // (maqueta + guía) and the hand-off read from to assemble the chosen options
    // of every sub-step. We merge (never overwrite the whole map).
    const prevHistory =
      phase.subStepHistory && typeof phase.subStepHistory === "object" && !Array.isArray(phase.subStepHistory)
        ? (phase.subStepHistory as Record<string, unknown>)
        : {};
    const subStepId = phase.subStep || "unknown";
    const subStepLabel =
      PHASE_SUBSTEPS[phase.type]?.find((s) => s.id === subStepId)?.label ?? subStepId;
    const historyEntry = {
      subStep: subStepId,
      label: subStepLabel,
      choice,
      artifact: phase.subStepArtifact ?? null,
      confirmedAt: new Date().toISOString(),
    };
    const nextHistory = {
      ...prevHistory,
      [subStepId]: historyEntry,
    } as Prisma.InputJsonValue;

    // Persist the user's choice on the phase BEFORE launching the next job,
    // so the webhook can read it and downstream agents receive it in
    // `previousArtifacts` (via the helper's `includePreviousSubStepArtifact`).
    await prisma.projectPhase.update({
      where: { id: phaseId },
      data: { subStepChoice: choice, subStepHistory: nextHistory },
    });

    // Consolida la decisión de identidad (nombre / tono) en la memoria del
    // proyecto. Best-effort: nunca debe tumbar la confirmación del sub-paso.
    if (phase.type === "IDENTITY") {
      await recordIdentityDecision(projectId, phase.sortOrder, subStepId, choice);
    }

    // Determine the next sub-step based on current position in PHASE_SUBSTEPS
    let nextSubStepName = nextSubStep;
    if (!nextSubStepName) {
      const substeps = PHASE_SUBSTEPS[phase.type];
      if (substeps && phase.subStep) {
        const currentIdx = substeps.findIndex((s) => s.id === phase.subStep);
        if (currentIdx >= 0 && currentIdx < substeps.length - 1) {
          nextSubStepName = substeps[currentIdx + 1].id;
        }
        // If currentIdx is the last one, nextSubStepName stays undefined → phase completes
      } else {
        // No current sub-step yet: IDENTITY starts at "naming". Other phase
        // types no longer use this route (Roadmap = quiz → report único).
        nextSubStepName = phase.type === "IDENTITY" ? "naming" : undefined;
      }
    }

    // ── Último sub-paso: CERRAR la fase (no encolar otro job) ──
    // Si no hay siguiente sub-paso, el usuario acaba de confirmar el último
    // (IDENTITY: el estilo visual 3d). Completamos la fase con un artefacto
    // resumen y arrancamos automáticamente la siguiente. La composición de los
    // assets 3d (maqueta + guía PDF) se hace bajo demanda en sus endpoints.
    if (!nextSubStepName) {
      let artifactContent: string;
      const artifactType = phase.type;
      if (phase.type === "IDENTITY") {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        artifactContent = buildIdentitySummaryMarkdown({
          projectName: project?.name || "Proyecto",
          subStepHistory: nextHistory,
          visualChoice: choice,
        });
      } else {
        // Fallback genérico: usar el contenido del último artefacto intermedio.
        const art = phase.subStepArtifact as { content?: string } | null;
        artifactContent = art?.content || `Sub-paso final confirmado: ${choice}`;
      }
      await completePhaseAndAutostart({
        projectId,
        phaseId,
        subStep: subStepId,
        artifact: {
          title: phase.label,
          content: artifactContent,
          type: artifactType,
        },
      });
      return NextResponse.json({ success: true, completed: true, choice });
    }

    // ── Sub-paso NO final: PAUSAR (no auto-arrancar el siguiente) ──
    // El usuario confirmó un sub-paso intermedio (naming → voice → logo). En
    // lugar de encolar automáticamente el siguiente, registramos la elección y
    // dejamos la fase en SUBSTEP_PENDING: la tarjeta mostrará "Iniciar
    // <siguiente sub-paso>" y solo entonces (vía /substep/start-next) se genera.
    //
    // Importante: NO movemos `subStep` ni `subStepArtifact`/`subStepOrder` — se
    // quedan en el sub-paso recién confirmado para que `start-next` pueda
    // calcular el siguiente desde la posición actual y reutilizar el artefacto
    // previo como contexto.
    await prisma.projectPhase.update({
      where: { id: phaseId },
      data: { status: "SUBSTEP_PENDING" },
    });

    return NextResponse.json({
      success: true,
      pendingNext: true,
      nextSubStep: nextSubStepName,
      choice,
    });
  } catch (error) {
    console.error(
      "[POST /api/projects/[id]/phases/[phaseId]/substep/choose]",
      error
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
