import { prisma } from "./db";

// big-pickle is currently the only free model that still works (as of 2026-06).
const AGENT_DEFAULTS: Record<string, string> = {
  generator: "opencode-zen-free/big-pickle",
  skeptic: "opencode-zen-free/big-pickle",
  defender: "opencode-zen-free/big-pickle",
  judge: "opencode-zen-free/big-pickle",
  refiner: "opencode-zen-free/big-pickle",
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
 * Resolution order:
 * 1. Individual key `agent_model_{agentId}` (legacy / direct override)
 * 2. Full config key `agent-models` (what the Settings UI saves as a JSON object)
 * 3. AGENT_DEFAULTS hardcoded fallback
 */
export async function getAgentModelForAgent(agentId: string): Promise<string> {
  const defaultModel = AGENT_DEFAULTS[agentId] || "opencode-zen-free/deepseek-v4-flash-free";

  try {
    // 1. Try individual key first (agent_model_{agentId})
    const setting = await prisma.setting.findFirst({
      where: { key: `agent_model_${agentId}` },
    });
    if (setting) {
      const value = typeof setting.value === "string" ? setting.value : String(setting.value);
      if (value) return value;
    }

    // 2. Try the full config blob ("agent-models") saved by Settings UI
    //    value is Prisma Json → already a JS object (not a string)
    const fullConfig = await prisma.setting.findFirst({
      where: { key: "agent-models" },
    });
    if (fullConfig?.value) {
      const configObj = fullConfig.value as Record<string, unknown>;
      // Direct JS object (Prisma Json type)
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
