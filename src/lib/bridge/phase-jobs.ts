import { prisma } from "@/lib/db";
import { resolveModelForJobAgent, agentForIdentitySubStep } from "@/lib/agent-models";
import { buildAgentContextRules } from "@/lib/agent-context-rules";
import type { ProjectMemory } from "@/lib/project-memory";
import { parsePreviousPhaseArtifacts } from "@/lib/phase-context-parser";
import {
  getNextIdentitySubStep,
  getIdentitySubStepIndex,
} from "@/lib/identity-substeps";

/**
 * Shared logic to enqueue a phase job. Used by:
 *  - POST /api/projects/execute-phase (initial quiz / direct report)
 *  - POST /api/projects/[id]/phases/[phaseId]/substep/choose
 *  - POST /api/projects/[id]/phases/[phaseId]/substep/iterate
 *
 * The function:
 *  1. Loads the project + idea context + previous completed-phase artifacts.
 *  2. Builds the job input payload (mode, subStep, ideaContext, previousArtifacts,
 *     answers, subStepChoice when applicable, _bridgeModel).
 *  3. Creates a Job row and sets the phase to PROCESSING.
 *  4. Returns { jobId, subStep, message }.
 */

// Agente único por fase. IDENTITY NO está aquí a propósito: se sirve con 4
// sub-skills (project-naming/voice/logo/template) elegidas por sub-paso vía
// `agentForIdentitySubStep()` más abajo. La monolítica `project-branding` ya
// no se usa en el flujo de identidad.
export const PHASE_TO_AGENT: Record<string, string> = {
  ANALYSIS: "project-analyst",
  CONTENT: "project-content",
  BUSINESS: "project-business",
  EXECUTION: "project-execution",
};

export interface EnqueuePhaseJobParams {
  projectId: string;
  phaseId: string;
  phaseType: string;
  mode: "questions" | "report";
  subStep?: string | null;
  /**
   * Optional override for IDENTITY phase sub-step auto-advance. If set, the
   * helper will use this exact subStep instead of computing the next one
   * from the IDENTITY_SUBSTEP_ORDER. Useful when the API wants to force a
   * specific sub-step (e.g. restart from naming).
   */
  subStepHint?: string | null;
  answers?: Record<string, string>;
  modelOverride?: string;
  // Optional: keep the previous subStepArtifact as part of previousArtifacts for
  // the next job. Set when we want the agent to know what was generated before
  // (e.g. the 3 mockups that the user just chose from).
  includePreviousSubStepArtifact?: boolean;
}

export interface EnqueuePhaseJobResult {
  jobId: string;
  subStep: string | null;
  message: string;
}

export async function enqueuePhaseJob(
  params: EnqueuePhaseJobParams
): Promise<EnqueuePhaseJobResult> {
  const {
    projectId,
    phaseId,
    phaseType,
    mode,
    subStep,
    subStepHint,
    answers,
    modelOverride,
    includePreviousSubStepArtifact = true,
  } = params;

  const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId } });
  if (!phase) {
    throw new Error("Phase not found");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      idea: {
        include: {
          reports: { orderBy: { createdAt: "desc" }, take: 1 },
          currentVersion: true,
        },
      },
      phases: {
        orderBy: { sortOrder: "asc" },
        where: { status: "COMPLETED" },
      },
    },
  });

  // Load Project.memory separately to avoid polluting the include chain
  const projectMemoryDoc = await prisma.project.findUnique({
    where: { id: projectId },
    select: { memory: true },
  });
  const projectMemory = (projectMemoryDoc?.memory as ProjectMemory) ?? null;
  if (!project) {
    throw new Error("Project not found");
  }

  const idea = project.idea;
  const latestReport = idea.reports[0];

  const ideaContext = {
    title: idea.title,
    description: idea.description,
    problem: idea.problem || "",
    valueProposition: idea.valueProposition || "",
    targetUser: idea.targetUser,
    monetization: idea.monetization,
    businessModel: idea.businessModel || "",
    verdict: idea.verdict || "",
    score: idea.score || 0,
    judgeReport: latestReport?.content?.slice(0, 3000) || "",
  };

  // Artefactos CRUDOS de cada fase previa COMPLETED (completada). Tomamos el
  // primer artefacto de cada fase (el informe consolidado) tal como se persiste.
  const rawPreviousArtifacts: Array<{ title: string; content: string }> = project.phases
    .filter((p) => p.artifacts)
    .map((p) => {
      const arts = p.artifacts as Array<{ title: string; content: string }> | null;
      return arts?.[0] || null;
    })
    .filter((a): a is { title: string; content: string } => a !== null);

  // For SUBSTEP_READY phases, also include the subStepArtifact + choice in
  // the context the next job will see.
  if (includePreviousSubStepArtifact && phase.status === "SUBSTEP_READY" && phase.subStepArtifact) {
    const subArtifact = phase.subStepArtifact as { type?: string; content?: string };
    if (subArtifact.content) {
      rawPreviousArtifacts.push({
        title: `SubStep ${phase.subStep || "intermedio"}`,
        content: subArtifact.content,
      });
    }
  }

  // Densidad de contexto: en lugar de inyectar los artefactos CRUDOS (que
  // pueden ser enormes e incluir ruido —quiz, opciones intermedias, debates—),
  // pasamos cada artefacto por el parser (analizador sintáctico) de densidad
  // de contexto. Esto extrae SOLO el resultado consolidado de cada fase y lo
  // acota en tamaño, ahorrando tokens (unidades de procesamiento de texto) sin
  // cambiar la forma { title, content } que el agente ya espera.
  const previousArtifacts: Array<{ title: string; content: string }> =
    parsePreviousPhaseArtifacts(rawPreviousArtifacts).map((s) => ({
      title: s.title,
      content: s.summary,
    }));

  // ── IDENTITY sub-step auto-advance ──
  // The IDENTITY phase is presented to the user as 4 sequential sub-steps
  // (naming → voice → logo → visual). When the client launches the next
  // job after a user confirmation, we auto-compute the next sub-step from
  // the current one. The caller can override this with `subStepHint` (e.g.
  // to restart from "naming" or to force a specific sub-step).
  //
  // For non-IDENTITY phases the explicit `subStep` argument wins as before.
  let effectiveSubStep: string | null;
  if (phaseType === "IDENTITY") {
    if (subStepHint) {
      effectiveSubStep = subStepHint;
    } else if (subStep) {
      // Explicit subStep provided by caller (e.g. "voice" from /substep/choose)
      // — use it directly, do NOT auto-advance
      effectiveSubStep = subStep;
    } else {
      // No subStep — auto-advance from current position
      effectiveSubStep = getNextIdentitySubStep(phase.subStep ?? null);
    }
  } else {
    effectiveSubStep = subStep ?? phase.subStep ?? null;
  }

  // Derive the 0-based order for the sub-step the agent is about to run.
  // For IDENTITY: 0=naming, 1=voice, 2=logo, 3=visual, null=null.
  // For other phases with sub-step: keep it null (those flows are
  // single-step from the user's perspective).
  const subStepOrder =
    phaseType === "IDENTITY"
      ? getIdentitySubStepIndex(effectiveSubStep)
      : null;

  // Agente que ejecuta el job. IDENTITY (Fase 3) está separada en 4 sub-skills
  // (project-naming/voice/logo/template): el agente se elige por el sub-paso que
  // toca. El resto de fases usan su agente único. El bridge selecciona el
  // SKILL.md del VPS por este `agentName`, y el modelo se resuelve por agente
  // (cada sub-skill es configurable por separado en Ajustes).
  const agentName =
    phaseType === "IDENTITY"
      ? agentForIdentitySubStep(effectiveSubStep)
      : PHASE_TO_AGENT[phaseType] || `project-${phaseType.toLowerCase()}`;
  const model = modelOverride || (await resolveModelForJobAgent(agentName));

  const contextRules = buildAgentContextRules(projectMemory);

  const jobInput: Record<string, unknown> = {
    mode,
    subStep: effectiveSubStep,
    subStepOrder,
    projectId,
    phaseId,
    phaseType,
    ideaContext,
    previousArtifacts,
    projectMemory: projectMemory ?? {},
    contextRules,
    _bridgeModel: model,
  };

  if (mode === "report" && answers) {
    jobInput.answers = answers;
  }

  if (phase.status === "SUBSTEP_READY") {
    jobInput.subStepChoice = phase.subStepChoice || null;
    if (phase.subStep) {
      jobInput.previousSubStep = phase.subStep;
    }
  }

  const job = await prisma.job.create({
    data: {
      ideaId: idea.id,
      agentName,
      status: "PENDING",
      input: JSON.stringify(jobInput),
    },
  });

  // Update phase status. We always set PROCESSING here, regardless of mode.
  // The webhook will transition the phase to QUESTIONING / SUBSTEP_READY /
  // COMPLETED based on the agent's output.
  await prisma.projectPhase.update({
    where: { id: phaseId },
    data: {
      status: "PROCESSING",
      subStep: effectiveSubStep,
      ...(phaseType === "IDENTITY" && subStepOrder !== null
        ? { subStepOrder }
        : {}),
    },
  });

  return {
    jobId: job.id,
    subStep: effectiveSubStep,
    message:
      mode === "questions"
        ? "Generando preguntas personalizadas..."
        : "Generando informe con tus respuestas...",
  };
}
