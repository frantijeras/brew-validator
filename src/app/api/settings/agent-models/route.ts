import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CONFIG_PATH = path.resolve(
  process.env.HOME || "/root",
  ".openclaw/workspace/skills/bridge-daemon/agent-models.json"
);

// Where to forward updates when the local bridge is running
const BRIDGE_URL = process.env.BRIDGE_API_URL ?? "http://127.0.0.1:9090";

// Default models used as fallback when nothing is configured.
// big-pickle is currently the only free model that still works (as of 2026-06).
const DEFAULT_MODELS: Record<string, string> = {
  generator: "opencode-zen-free/big-pickle",
  skeptic: "opencode-zen-free/big-pickle",
  defender: "opencode-zen-free/big-pickle",
  judge: "opencode-zen-free/big-pickle",
  refiner: "opencode-zen-free/big-pickle",
  "project-analyst": "opencode-go/deepseek-v4-flash",
  "project-branding": "opencode-go/deepseek-v4-flash",
  "project-content": "opencode-go/deepseek-v4-flash",
  "project-dev": "opencode-go/deepseek-v4-flash",
  "project-dossier": "opencode-go/deepseek-v4-flash",
};

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

function writeConfigToFile(config: Record<string, string>): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

async function saveConfigToDB(
  userId: string,
  config: Record<string, string>
): Promise<void> {
  await prisma.setting.upsert({
    where: { key_userId: { key: "agent-models", userId } },
    create: { key: "agent-models", value: config, userId },
    update: { value: config },
  });
}

async function forwardToBridge(
  config: Record<string, string>
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

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
// Public endpoint — the bridge daemon polls this without auth.
// Returns the latest saved config (per user when authenticated, otherwise
// the most recently saved user's config — single-tenant today).
export async function GET() {
  // Priority: DB (user settings) > file (bridge-synced) > defaults
  // Merge with defaults so any agent without explicit config gets a fallback.

  const dbConfig = await readConfigFromDB();
  const fileConfig = await readConfigFromFile();

  if (dbConfig) {
    // DB is the source of truth — merge with defaults for missing agents
    return NextResponse.json({ ...DEFAULT_MODELS, ...dbConfig });
  }

  if (fileConfig) {
    // File config merged with defaults (covers project agents not in file)
    return NextResponse.json({ ...DEFAULT_MODELS, ...fileConfig });
  }

  // Fallback to hardcoded defaults
  return NextResponse.json(DEFAULT_MODELS);
}

// POST /api/settings/agent-models
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Formato inválido: se esperaba un objeto" },
        { status: 400 }
      );
    }

    const config = body as Record<string, string>;

    // 1. Always persist to DB FIRST — this is the durable source of truth
    //    used by resolveModelForJobAgent() when creating jobs.
    await saveConfigToDB(session.user.id, config);

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
