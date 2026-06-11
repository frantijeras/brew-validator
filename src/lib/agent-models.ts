import { prisma } from "./db";

const AGENT_DEFAULTS: Record<string, string> = {
  generator: "opencode-zen-free/deepseek-v4-flash-free",
  skeptic: "opencode-zen-free/deepseek-v4-flash-free",
  defender: "opencode-zen-free/deepseek-v4-flash-free",
  judge: "opencode-zen-free/minimax-m3-free",
  refiner: "opencode-zen-free/deepseek-v4-flash-free",
  "project-analyst": "opencode-go/deepseek-v4-flash",
  "project-branding": "opencode-go/deepseek-v4-flash",
  "project-content": "opencode-go/deepseek-v4-flash",
  "project-business": "opencode-go/deepseek-v4-flash",
  "project-execution": "opencode-go/deepseek-v4-flash",
  "project-skills": "opencode-go/deepseek-v4-flash",
};

const JOB_AGENT_TO_SETTINGS_KEY: Record<string, string> = {
  "idea-generator": "generator",
  skeptic: "skeptic",
  advocate: "defender",
  judge: "judge",
  "brew-qa-refiner": "refiner",
  "idea-renamer": "generator",
  "project-analyst": "project-analyst",
  "project-branding": "project-branding",
  "project-content": "project-content",
  "project-business": "project-business",
  "project-execution": "project-execution",
  "project-skills": "project-skills",
};

export const PROJECT_AGENTS = [
  "project-analyst",
  "project-branding",
  "project-content",
  "project-business",
  "project-execution",
  "project-skills",
];

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
