import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getBridgeHealth } from "@/lib/bridge/health";

/**
 * Reaper de procesos colgados (timeout / auto-saneado).
 *
 * El bridge es un daemon externo: si se cae, no responde o se queda sin tokens
 * y el callback nunca llega, los Jobs quedan PENDING/RUNNING y sus recursos
 * (fase PROCESSING, idea VALIDATING, skill "ai-pending") se quedan colgados
 * indefinidamente. Esta función marca como FAILED los jobs más viejos que el
 * timeout y RESETEA su recurso a un estado usable, con un error claro.
 *
 * No depende del bridge: se invoca de forma "lazy" al cargar el proyecto y
 * desde un Vercel Cron, así que se auto-cura aunque el bridge esté muerto.
 */

const DEFAULT_TIMEOUT_MS = Number(process.env.BRIDGE_JOB_TIMEOUT_MS) || 10 * 60 * 1000; // 10 min

/** Agentes que operan sobre la idea (no sobre fases de proyecto ni skills). */
const IDEA_AGENTS = new Set([
  "skeptic",
  "advocate",
  "judge",
  "idea-generator",
]);

export interface ReapResult {
  jobs: number;
  phases: number;
  ideas: number;
  skills: number;
}

export async function reapStuckProcesses(opts?: {
  projectId?: string;
  timeoutMs?: number;
}): Promise<ReapResult> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cutoff = new Date(Date.now() - timeoutMs);
  const result: ReapResult = { jobs: 0, phases: 0, ideas: 0, skills: 0 };

  // Scope opcional por proyecto (los jobs cuelgan del ideaId del proyecto).
  let ideaIdFilter: string | undefined;
  if (opts?.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: opts.projectId },
      select: { ideaId: true },
    });
    if (!project) return result;
    ideaIdFilter = project.ideaId;
  }

  const stuck = await prisma.job.findMany({
    where: {
      status: { in: ["PENDING", "RUNNING"] },
      createdAt: { lt: cutoff },
      ...(ideaIdFilter ? { ideaId: ideaIdFilter } : {}),
    },
    select: { id: true, ideaId: true, agentName: true, input: true },
  });
  if (stuck.length === 0) return result;

  // Motivo del atasco: si el bridge está caído (sin heartbeat) lo decimos
  // explícitamente; si está vivo, fue un timeout del job. Así el usuario ve EN
  // LA FASE por qué se reinició, no solo "timeout" genérico.
  const minutes = Math.round(timeoutMs / 60000);
  const health = await getBridgeHealth().catch(() => ({ reachable: false } as { reachable: boolean }));
  const errMsg = health.reachable
    ? `El proceso superó el tiempo límite (${minutes} min) sin respuesta del motor de IA. Se reinició: vuelve a intentarlo.`
    : `El motor de IA (bridge) no respondió: el servicio parece estar caído. El proceso se reinició; reinténtalo cuando vuelva a estar disponible.`;
  const lastError = {
    message: errMsg,
    category: health.reachable ? "timeout" : "server_error",
    timestamp: new Date().toISOString(),
  } as unknown as Prisma.InputJsonValue;

  for (const job of stuck) {
    // Atomic claim: solo un reaper concurrente gana cada job.
    const claim = await prisma.job.updateMany({
      where: { id: job.id, status: { in: ["PENDING", "RUNNING"] } },
      data: { status: "FAILED", error: errMsg, finishedAt: new Date() },
    });
    if (claim.count === 0) continue;
    result.jobs += claim.count;

    let input: Record<string, unknown> = {};
    try {
      input = job.input ? (JSON.parse(job.input) as Record<string, unknown>) : {};
    } catch {
      input = {};
    }
    const phaseId = typeof input.phaseId === "string" ? input.phaseId : null;
    const projectId = typeof input.projectId === "string" ? input.projectId : null;
    const skillId = typeof input.skillId === "string" ? input.skillId : null;

    try {
      if (phaseId) {
        // Fase de proyecto colgada → vuelve a AVAILABLE con error de timeout.
        const upd = await prisma.projectPhase.updateMany({
          where: {
            id: phaseId,
            status: { in: ["PROCESSING", "QUESTIONING", "SUBSTEP_READY"] },
          },
          data: { status: "AVAILABLE", lastError },
        });
        result.phases += upd.count;
      } else if (skillId && projectId) {
        // Skill "Mejorar con IA" colgada → revierte ai-pending a su plantilla.
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { generatedSkills: true },
        });
        const skills = Array.isArray(project?.generatedSkills)
          ? (project!.generatedSkills as unknown as Array<{
              id: string;
              source?: string;
              content?: string;
            }>)
          : null;
        if (skills) {
          let changed = false;
          const next = skills.map((s) => {
            if (s.id === skillId && s.source === "ai-pending") {
              changed = true;
              return { ...s, source: s.content ? "template" : s.source };
            }
            return s;
          });
          if (changed) {
            await prisma.project.update({
              where: { id: projectId },
              data: { generatedSkills: next as unknown as Prisma.InputJsonValue },
            });
            result.skills += 1;
          }
        }
      } else if (IDEA_AGENTS.has(job.agentName)) {
        // Validación / generación / refinamiento de idea colgado.
        const unstuck = await prisma.idea.updateMany({
          where: {
            id: job.ideaId,
            status: { in: ["VALIDATING", "GENERATING", "REFINING", "POLISHING"] },
          },
          data: { status: "DRAFT" },
        });
        await prisma.idea.updateMany({
          where: { id: job.ideaId, validationStatus: "RUNNING" },
          data: { validationStatus: "FAILED" },
        });
        result.ideas += unstuck.count;
      }
    } catch (e) {
      console.error("[reaper] no se pudo resetear el recurso del job", job.id, e);
    }
  }

  return result;
}
