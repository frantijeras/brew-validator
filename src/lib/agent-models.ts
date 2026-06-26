import { prisma } from "./db";

/**
 * Planes de suscripción. Cada plan puede tener su propia configuración de
 * modelos/razonamiento por agente, guardada en Settings con las claves
 * `agent-models:<plan>` / `agent-thinking:<plan>` (misma forma JSON que la
 * config global legacy "agent-models"/"agent-thinking").
 */
export const AI_PLANS = ["gratis", "estandar", "premium"] as const;
export type AiPlan = (typeof AI_PLANS)[number];

function isAiPlan(value: unknown): value is AiPlan {
  return typeof value === "string" && (AI_PLANS as readonly string[]).includes(value);
}

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

/** Lee el `plan` del usuario. Devuelve null si no hay userId o la DB falla. */
async function getUserPlan(userId: string | null | undefined): Promise<AiPlan | null> {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });
    return isAiPlan(user?.plan) ? user.plan : null;
  } catch {
    return null;
  }
}

/** Lee un map { settingsKey: model } de un Setting por clave. */
async function readModelMap(key: string): Promise<Record<string, unknown> | null> {
  try {
    const setting = await prisma.setting.findFirst({ where: { key } });
    if (setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)) {
      return setting.value as Record<string, unknown>;
    }
  } catch {
    // DB unreachable
  }
  return null;
}

/**
 * Resuelve el modelo para un agente (por su clave de ajustes). Cadena de
 * resolución:
 *   1. Si hay `plan`, el Setting `agent-models:<plan>`.
 *   2. El Setting global legacy `agent-models`.
 *   3. AGENT_DEFAULTS.
 * Sin `plan` se comporta como antes (solo legacy global → defaults).
 */
export async function getAgentModelForAgent(
  agentId: string,
  plan?: AiPlan | null
): Promise<string> {
  const defaultModel = AGENT_DEFAULTS[agentId] || "opencode-zen-free/deepseek-v4-flash-free";

  // 1. Per-plan config (only when a plan is given)
  if (plan) {
    const planConfig = await readModelMap(`agent-models:${plan}`);
    if (planConfig) {
      const model = planConfig[agentId];
      if (typeof model === "string" && model) return model;
    }
  }

  // 2. Legacy global config (back-compat)
  const fullConfig = await readModelMap("agent-models");
  if (fullConfig) {
    const model = fullConfig[agentId];
    if (typeof model === "string" && model) return model;
  }

  // 3. Hardcoded default
  return defaultModel;
}

export function getSettingsKeyForJobAgent(jobAgentName: string): string {
  return JOB_AGENT_TO_SETTINGS_KEY[jobAgentName] || "generator";
}

/**
 * Resuelve el modelo para un job. Si se pasa `userId`, se usa el plan de ese
 * usuario (dueño del job) para elegir su config de modelos; si no, cae a la
 * config global legacy (back-compat).
 */
export async function resolveModelForJobAgent(
  jobAgentName: string,
  userId?: string | null
): Promise<string> {
  const settingsKey = getSettingsKeyForJobAgent(jobAgentName);
  const plan = await getUserPlan(userId);
  return getAgentModelForAgent(settingsKey, plan);
}

/* ── Reasoning level (thinking) — mirror of the model config above ── */

// Niveles de razonamiento aceptados por el CLI a través del bridge (--thinking).
export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

// Nivel por defecto cuando no hay configuración (acordado con el bridge: "low").
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = "low";

function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === "string" && (THINKING_LEVELS as readonly string[]).includes(value);
}

/**
 * Resuelve el nivel de razonamiento configurado para un agente (por su clave de
 * ajustes). Lee el Setting `"agent-thinking"` (JSON { settingsKey: level }) y
 * cae al default "low". Refleja el estilo de búsqueda de getAgentModelForAgent.
 */
export async function getThinkingForAgent(
  agentId: string,
  plan?: AiPlan | null
): Promise<ThinkingLevel> {
  // 1. Per-plan config
  if (plan) {
    const planConfig = await readModelMap(`agent-thinking:${plan}`);
    if (planConfig) {
      const level = planConfig[agentId];
      if (isThinkingLevel(level)) return level;
    }
  }

  // 2. Legacy global config (back-compat)
  const fullConfig = await readModelMap("agent-thinking");
  if (fullConfig) {
    const level = fullConfig[agentId];
    if (isThinkingLevel(level)) return level;
  }

  // 3. Default
  return DEFAULT_THINKING_LEVEL;
}

export async function resolveThinkingForJobAgent(
  jobAgentName: string,
  userId?: string | null
): Promise<ThinkingLevel> {
  const settingsKey = getSettingsKeyForJobAgent(jobAgentName);
  const plan = await getUserPlan(userId);
  return getThinkingForAgent(settingsKey, plan);
}

/* ── Per-plan config readers (used by the settings route) ── */

/**
 * Devuelve el map { settingsKey: model } de un plan. Cadena de fallback:
 * Setting `agent-models:<plan>` → Setting global legacy `agent-models` → {}.
 * Así los 3 planes arrancan = config actual mientras no se personalice ninguno.
 */
export async function getPlanModels(plan: AiPlan): Promise<Record<string, string>> {
  const planConfig = await readModelMap(`agent-models:${plan}`);
  const source = planConfig ?? (await readModelMap("agent-models"));
  const out: Record<string, string> = {};
  if (source) {
    for (const [k, v] of Object.entries(source)) {
      if (typeof v === "string" && v) out[k] = v;
    }
  }
  return out;
}

/**
 * Devuelve el map { settingsKey: thinkingLevel } de un plan. Mismo fallback que
 * getPlanModels: `agent-thinking:<plan>` → global legacy → {}.
 */
export async function getPlanThinking(plan: AiPlan): Promise<Record<string, ThinkingLevel>> {
  const planConfig = await readModelMap(`agent-thinking:${plan}`);
  const source = planConfig ?? (await readModelMap("agent-thinking"));
  const out: Record<string, ThinkingLevel> = {};
  if (source) {
    for (const [k, v] of Object.entries(source)) {
      if (isThinkingLevel(v)) out[k] = v;
    }
  }
  return out;
}
