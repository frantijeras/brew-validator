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

// Default models used as fallback when nothing is configured
const DEFAULT_MODELS: Record<string, string> = {
  generator: "opencode-zen-free/deepseek-v4-flash-free",
  skeptic: "opencode-zen-free/deepseek-v4-flash-free",
  defender: "opencode-zen-free/deepseek-v4-flash-free",
  judge: "opencode-zen-free/minimax-m3-free",
  refiner: "opencode-zen-free/deepseek-v4-flash-free",
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
// Public endpoint — the bridge daemon polls this without auth
export async function GET() {
  // 3-level fallback: file → DB → defaults

  // 1. agent-models.json local (synced by bridge)
  const fileConfig = await readConfigFromFile();
  if (fileConfig) {
    return NextResponse.json(fileConfig);
  }

  // 2. DB (tabla Setting) — any user's config
  const dbConfig = await readConfigFromDB();
  if (dbConfig) {
    return NextResponse.json(dbConfig);
  }

  // 3. Defaults
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

    // 1. Try to forward to the local bridge daemon
    const bridgeOk = await forwardToBridge(config);

    if (bridgeOk) {
      return NextResponse.json({ success: true, savedTo: "bridge" });
    }

    // 2. Bridge not available (Vercel serverless) — save to file + DB
    try {
      writeConfigToFile(config);
    } catch {
      // file write may fail in serverless — that's expected
    }

    // 3. Always persist to DB as reliable fallback
    await saveConfigToDB(session.user.id, config);

    return NextResponse.json({ success: true, savedTo: "db" });
  } catch (err) {
    console.error("[POST /api/settings/agent-models]", err);
    return NextResponse.json(
      { error: "Error al guardar la configuración" },
      { status: 500 }
    );
  }
}
