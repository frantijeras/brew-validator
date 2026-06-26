import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { AI_PLANS, type AiPlan, getPlanModels, getPlanThinking } from "@/lib/agent-models";

function parsePlan(value: unknown): AiPlan | null {
  return typeof value === "string" && (AI_PLANS as readonly string[]).includes(value)
    ? (value as AiPlan)
    : null;
}

// Agent → model id map. Both keys and values must be non-empty strings; this
// rejects nested objects, arrays or non-string values being injected as config.
const agentModelsSchema = z.record(z.string().min(1), z.string().min(1));

// Agent → reasoning level map. Values restricted to the valid thinking levels.
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high"] as const;
const agentThinkingSchema = z.record(
  z.string().min(1),
  z.enum(THINKING_LEVELS)
);

// POST body: accepts either the legacy FLAT model map (back-compat) OR the
// wrapped shape { models, thinking?, plan? } so reasoning levels (and an
// optional target plan) can be saved too.
const wrappedBodySchema = z.object({
  plan: z.enum(AI_PLANS).optional(),
  models: agentModelsSchema,
  thinking: agentThinkingSchema.optional(),
});

function isWrappedBody(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "models" in body &&
    typeof (body as Record<string, unknown>).models === "object"
  );
}

const CONFIG_PATH = path.resolve(
  process.env.HOME || "/root",
  ".openclaw/workspace/skills/bridge-daemon/agent-models.json"
);

// Where to forward updates when the local bridge is running
const BRIDGE_URL = process.env.BRIDGE_API_URL ?? "http://127.0.0.1:9090";

// Default models used as fallback when nothing is configured.
// Se usan modelos gratuitos (-free) presentes en la lista de modelos disponibles.
const DEFAULT_MODELS: Record<string, string> = {
  generator: "opencode-zen-free/deepseek-v4-flash-free",
  skeptic: "opencode-zen-free/deepseek-v4-flash-free",
  defender: "opencode-zen-free/deepseek-v4-flash-free",
  // minimax-m3-free no devuelve JSON válido para el juez; deepseek sí.
  judge: "opencode-zen-free/deepseek-v4-flash-free",
  // Alineado con el modelo operativo del bridge (antes "opencode-go/..." no
  // operativo dejaba colgadas las fases de Identidad).
  "project-analyst": "opencode-zen-free/mimo-v2.5-free",
  "project-branding": "opencode-zen-free/mimo-v2.5-free",
  "project-naming": "opencode-zen-free/mimo-v2.5-free",
  "project-voice": "opencode-zen-free/mimo-v2.5-free",
  "project-logo": "opencode-zen-free/mimo-v2.5-free",
  "project-template": "opencode-zen-free/mimo-v2.5-free",
  "project-content": "opencode-zen-free/mimo-v2.5-free",
  "project-business": "opencode-zen-free/mimo-v2.5-free",
  "project-execution": "opencode-zen-free/mimo-v2.5-free",
}

async function readConfigFromFile(): Promise<Record<string, string> | null> {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

async function readConfigFromDB(): Promise<Record<string, string> | null> {
  try {
    const setting = await prisma.setting.findFirst({
      where: { key: "agent-models" },
    });
    if (!setting) return null;
    return setting.value as Record<string, string>;
  } catch {
    return null;
  }
}

async function readThinkingFromDB(): Promise<Record<string, string> | null> {
  try {
    const setting = await prisma.setting.findFirst({
      where: { key: "agent-thinking" },
    });
    if (!setting) return null;
    return setting.value as Record<string, string>;
  } catch {
    return null;
  }
}

function writeConfigToFile(config: Record<string, string>): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

async function saveConfigToDB(
  userId: string,
  config: Record<string, string>,
  key = "agent-models"
): Promise<void> {
  await prisma.setting.upsert({
    where: { key_userId: { key, userId } },
    create: { key, value: config, userId },
    update: { value: config },
  });
}

async function saveThinkingToDB(
  userId: string,
  thinking: Record<string, string>,
  key = "agent-thinking"
): Promise<void> {
  await prisma.setting.upsert({
    where: { key_userId: { key, userId } },
    create: { key, value: thinking, userId },
    update: { value: thinking },
  });
}

async function forwardToBridge(
  config: Record<string, string>
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    // The bridge's /api/update-models validates each value as a model id, so we
    // forward ONLY the flat model map here (thinking is delivered per-job via
    // each job's _thinking field — see resolveThinkingForJobAgent).
    const res = await fetch(`${BRIDGE_URL}/api/update-models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    // Bridge not reachable — that's fine, we'll fall back
    return false;
  }
}

// GET /api/settings/agent-models
// Gated by the middleware (session OR bridge secret) — the bridge daemon polls
// it with the shared secret. Returns the latest saved config (single-tenant
// today: the most recently saved user's config).
export async function GET(request: Request) {
  // Priority: DB (user settings) > file (bridge-synced) > defaults
  // Merge with defaults so any agent without explicit config gets a fallback.
  //
  // BACK-COMPAT: the response keeps the FLAT { agent: model } map at the top
  // level (the bridge's sync_model_settings reads it directly). Reasoning
  // levels are exposed as a SIBLING top-level `thinking` key — the bridge
  // looks up models by specific agent name, so this extra key is ignored
  // there and never breaks the model sync.

  // Per-plan request (?plan=gratis|estandar|premium): return that plan's
  // models+thinking. getPlanModels/getPlanThinking fall back to the legacy
  // global config (and then defaults), so all 3 plans START identical to the
  // current config until each one is personalised. We still merge DEFAULT_MODELS
  // so any agent missing from the source map gets a sane fallback.
  const plan = parsePlan(new URL(request.url).searchParams.get("plan"));
  if (plan) {
    const planModels = await getPlanModels(plan);
    const planThinking = await getPlanThinking(plan);
    return NextResponse.json({
      ...DEFAULT_MODELS,
      ...planModels,
      thinking: planThinking,
    });
  }

  const dbConfig = await readConfigFromDB();
  const fileConfig = await readConfigFromFile();
  const dbThinking = await readThinkingFromDB();

  const thinking = dbThinking ?? {};

  if (dbConfig) {
    // DB is the source of truth — merge with defaults for missing agents
    return NextResponse.json({ ...DEFAULT_MODELS, ...dbConfig, thinking });
  }

  if (fileConfig) {
    // File config merged with defaults (covers project agents not in file)
    return NextResponse.json({ ...DEFAULT_MODELS, ...fileConfig, thinking });
  }

  // Fallback to hardcoded defaults
  return NextResponse.json({ ...DEFAULT_MODELS, thinking });
}

// POST /api/settings/agent-models
export async function POST(request: Request) {
  const session = await auth();
  // Config del sistema: solo admin puede modificarla.
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Normalise both shapes into { config, thinking?, plan? }.
    let config: Record<string, string>;
    let thinking: Record<string, string> | undefined;
    let plan: AiPlan | null = null;

    if (isWrappedBody(body)) {
      const parsed = wrappedBodySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Formato inválido: se esperaba { plan?, models, thinking }",
            details: parsed.error.flatten(),
          },
          { status: 400 }
        );
      }
      config = parsed.data.models;
      thinking = parsed.data.thinking;
      plan = parsed.data.plan ?? null;
    } else {
      const parsed = agentModelsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Formato inválido: se esperaba un objeto { agente: modelo } de strings",
            details: parsed.error.flatten(),
          },
          { status: 400 }
        );
      }
      config = parsed.data;
      thinking = undefined;
    }

    // Per-plan save: persist ONLY to the plan-specific Setting keys. The bridge
    // needs no plan knowledge (the model/thinking travel per-job in
    // _bridgeModel/_thinking, resolved from the owner's plan at job creation),
    // so we do NOT write the file nor forward to the bridge for plan configs.
    if (plan) {
      await saveConfigToDB(session.user.id, config, `agent-models:${plan}`);
      if (thinking) {
        await saveThinkingToDB(session.user.id, thinking, `agent-thinking:${plan}`);
      }
      return NextResponse.json({ success: true, savedTo: "db", plan });
    }

    // Legacy global save (no plan): keep persisting to the global keys + file +
    // bridge exactly as before for back-compat.

    // 1. Always persist to DB FIRST — this is the durable source of truth
    //    used by resolveModelForJobAgent() when creating jobs.
    await saveConfigToDB(session.user.id, config);

    // 1b. Persist reasoning levels too (additive — only if provided).
    if (thinking) {
      await saveThinkingToDB(session.user.id, thinking);
    }

    // 2. Always try to write to the local file (works on Fran's VPS,
    //    silently fails on Vercel serverless). The bridge daemon reads
    //    this file on startup and during sync_model_settings().
    try {
      writeConfigToFile(config);
    } catch {
      // file write may fail in serverless — that's expected
    }

    // 3. Best-effort: push the new config to the live bridge process so
    //    the change takes effect immediately, without waiting for the
    //    next sync poll. Failure here is non-fatal — the bridge will
    //    pick up the new config on its next sync (every ~30s).
    const bridgeOk = await forwardToBridge(config);

    return NextResponse.json({
      success: true,
      savedTo: "db",
      bridgeNotified: bridgeOk,
    });
  } catch (err) {
    console.error("[POST /api/settings/agent-models]", err);
    return NextResponse.json(
      { error: "Error al guardar la configuración" },
      { status: 500 }
    );
  }
}
