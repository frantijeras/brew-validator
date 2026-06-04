import { prisma } from "./db";

const AGENT_DEFAULTS: Record<string, string> = {
  generator: "opencode-zen-free/deepseek-v4-flash-free",
  skeptic: "opencode-zen-free/deepseek-v4-flash-free",
  defender: "opencode-zen-free/deepseek-v4-flash-free",
  judge: "opencode-zen-free/big-pickle",
  refiner: "opencode-zen-free/deepseek-v4-flash-free",
};

/**
 * Maps job agent names (used in prisma.job.agentName) to
 * settings keys (used in Setting.key as agent_model_{key}).
 */
const JOB_AGENT_TO_SETTINGS_KEY: Record<string, string> = {
  "idea-generator": "generator",
  "skeptic": "skeptic",
  "advocate": "defender",
  "judge": "judge",
  "brew-qa-refiner": "refiner",
  "idea-renamer": "generator",
};

/**
 * Returns the configured model for a settings-level agent id
 * (generator, skeptic, defender, judge, refiner).
 *
 * Reads from the Setting table using key `agent_model_{agentId}`,
 * falling back to AGENT_DEFAULTS.
 */
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
  } catch {
    // DB unreachable — use default
  }

  return defaultModel;
}

/**
 * Returns the settings key (generator, skeptic, defender, judge, refiner)
 * for a given job agent name (idea-generator, skeptic, advocate, judge, etc.).
 */
export function getSettingsKeyForJobAgent(jobAgentName: string): string {
  return JOB_AGENT_TO_SETTINGS_KEY[jobAgentName] || "generator";
}

/**
 * Resolves the model for a job agent name by:
 * 1. Mapping the job agent name to a settings key
 * 2. Looking up the model in the Setting table
 * 3. Falling back to defaults
 */
export async function resolveModelForJobAgent(jobAgentName: string): Promise<string> {
  const settingsKey = getSettingsKeyForJobAgent(jobAgentName);
  return getAgentModelForAgent(settingsKey);
}
