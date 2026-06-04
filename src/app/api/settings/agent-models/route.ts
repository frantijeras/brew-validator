import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CONFIG_PATH = path.resolve(
  process.env.HOME || "/root",
  ".openclaw/workspace/skills/bridge-daemon/agent-models.json"
);

function readConfig(): Record<string, string> | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

function writeConfig(config: Record<string, string>): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// GET /api/settings/agent-models
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const config = readConfig();
  return NextResponse.json(config ?? {});
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

    writeConfig(body as Record<string, string>);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/settings/agent-models]", err);
    return NextResponse.json(
      { error: "Error al guardar la configuración" },
      { status: 500 }
    );
  }
}
