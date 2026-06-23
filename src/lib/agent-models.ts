import { prisma } from "./db";

const AGENT_DEFAULTS: Record<string, string> = {
  generator: "opencode-zen-free/deepseek-v4-flash-free",
  skeptic: "opencode-zen-free/deepseek-v4-flash-free",
  defender: "opencode-zen-free/deepseek-v4-flash-free",
  // minimax-m3-free no devuelve JSON válido para el juez (falla incluso con
  // reintento); deepseek-v4-flash-free sí produce scorecard+veredicto fiables.
  judge: "opencode-zen-free/deepseek-v4-flash-free",
  // TODOS los agentes de proyecto usan un modelo operativo del bridge
  // (opencode-zen-free/mimo-v2.5-free). El proveedor "opencode-go" NO está
  // operativo para el agente 'brew' y hacía que los jobs fallaran con
  // "returned None / respuesta vacía" (p. ej. la fase de Análisis de mercado).
  "project-analyst": "opencode-zen-free/mimo-v2.5-free",
  "project-branding": "opencode-zen-free/mimo-v2.5-free",
  "project-naming": "opencode-zen-free/mimo-v2.5-free",
  "project-voice": "opencode-zen-free/mimo-v2.5-free",
  "project-logo": "opencode-zen-free/mimo-v2.5-free",
  "project-template": "opencode-zen-free/mimo-v2.5-free",
  "project-content": "opencode-zen-free/mimo-v2.5-free",
  "project-business": "opencode-zen-free/mimo-v2.5-free",
  "project-execution": "opencode-zen-free/mimo-v2.5-free",
};

const JOB_AGENT_TO_SETTINGS_KEY: Record<string, string> = {
  "idea-generator": "generator",
  skeptic: "skeptic",
  advocate: "defender",
  judge: "judge",
  "project-analyst": "project-analyst",
  "project-branding": "project-branding",
  "project-naming": "project-naming",
  "project-voice": "project-voice",
  "project-logo": "project-logo",
  "project-template": "project-template",
  "project-content": "project-content",
  "project-business": "project-business",
  "project-execution": "project-execution",
};

export const PROJECT_AGENTS = [
  "project-analyst",
  "project-naming",
  "project-voice",
  "project-logo",
  "project-template",
  "project-content",
  "project-business",
  "project-execution",
];

/**
 * IDENTITY (Fase 3) se sirve con 4 sub-skills independientes, una por sub-paso.
 * El bridge selecciona el SKILL.md por `agentName`, así que el job debe llevar
 * el agente correcto según el sub-paso que toca ejecutar.
 */
export const IDENTITY_SUBSTEP_AGENT: Record<string, string> = {
  naming: "project-naming",
  voice: "project-voice",
  logo: "project-logo",
  visual: "project-template",
};

export function agentForIdentitySubStep(subStep: string | null | undefined): string {
  return (subStep && IDENTITY_SUBSTEP_AGENT[subStep]) || "project-naming";
}

export function isProjectAgent(agentName: string): boolean {
  return PROJECT_AGENTS.includes(agentName);
}

export async function getAgentModelForAgent(agentId: string): Promise<string> {
  const defaultModel = AGENT_DEFAULTS[agentId] || "opencode-zen-free/deepseek-v4-flash-free";

  try {
    const setting = await prisma.setting.findFirst({
      where: { key: `agent_model_${agentId}` },
    });
    if (setting) {
      const value = typeof setting.value === "string" ? setting.value : String(setting.value);
      if (value) return value;
    }

    const fullConfig = await prisma.setting.findFirst({
      where: { key: "agent-models" },
    });
    if (fullConfig?.value) {
      const configObj = fullConfig.value as Record<string, unknown>;
      if (typeof configObj === "object" && !Array.isArray(configObj)) {
        const model = (configObj as Record<string, unknown>)[agentId];
        if (typeof model === "string" && model) return model;
      }
    }
  } catch {
    // DB unreachable — use default
  }

  return defaultModel;
}

export function getSettingsKeyForJobAgent(jobAgentName: string): string {
  return JOB_AGENT_TO_SETTINGS_KEY[jobAgentName] || "generator";
}

export async function resolveModelForJobAgent(jobAgentName: string): Promise<string> {
  const settingsKey = getSettingsKeyForJobAgent(jobAgentName);
  return getAgentModelForAgent(settingsKey);
}
