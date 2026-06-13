import type { ProjectMemory } from "@/lib/project-memory";

/**
 * Contexto de proyecto compartido para la generación de skills (plantillas) y
 * la mejora con IA (Fase 2). Extraído de skills/generate/route.ts para que
 * tanto la generación determinista como el agente IA usen el mismo contexto.
 */
export interface ProjectContext {
  projectName: string;
  description: string;
  targetUser: string;
  valueProposition: string | null;
  problem: string | null;
  monetization: string;
  businessModel: string | null;
  completedPhases: Array<{ label: string; type: string }>;
  memoryEntries: Array<[string, string]>;
  brandColors: Array<{ name: string; value: string }>;
  keywords: string[];
  channels: string[];
  tone: string | null;
}

export function buildProjectContext(project: {
  name: string;
  description: string | null;
  idea: {
    targetUser: string;
    valueProposition: string | null;
    problem: string | null;
    monetization: string;
    businessModel: string | null;
  };
  phases: Array<{ label: string; type: string; status: string }>;
  memory: ProjectMemory | null;
}): ProjectContext {
  const completedPhases = project.phases
    .filter((p) => p.status === "COMPLETED")
    .map((p) => ({ label: p.label, type: p.type }));

  const memoryEntries: Array<[string, string]> = [];
  if (project.memory) {
    for (const [key, entry] of Object.entries(project.memory)) {
      if (entry && entry.value !== null && entry.value !== undefined) {
        const val =
          typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value);
        memoryEntries.push([key, val]);
      }
    }
  }

  const tone = project.memory?.tone?.value as string | null;
  const channels = project.memory?.channels?.value as string[] | string | null;
  const keywords = project.memory?.keywords?.value as string[] | string | null;

  return {
    projectName: project.name,
    description: project.description || project.idea.valueProposition || "",
    targetUser: project.idea.targetUser,
    valueProposition: project.idea.valueProposition,
    problem: project.idea.problem,
    monetization: project.idea.monetization,
    businessModel: project.idea.businessModel,
    completedPhases,
    memoryEntries,
    brandColors: [],
    keywords: Array.isArray(keywords) ? keywords : keywords ? [keywords] : [],
    channels: Array.isArray(channels) ? channels : channels ? [channels] : [],
    tone,
  };
}
