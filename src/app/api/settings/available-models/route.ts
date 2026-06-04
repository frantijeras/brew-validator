import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const AVAILABLE_MODELS_PATH = path.resolve(
  process.env.HOME || "/root",
  ".openclaw/credentials/available-models.json"
);

type ModelOption = {
  value: string;
  label: string;
};

function readAvailableModels(): ModelOption[] | null {
  try {
    if (!fs.existsSync(AVAILABLE_MODELS_PATH)) return null;
    const raw = fs.readFileSync(AVAILABLE_MODELS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as ModelOption[];
    }
    return null;
  } catch {
    return null;
  }
}

// GET /api/settings/available-models
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const models = readAvailableModels();
  if (models) {
    return NextResponse.json(models);
  }

  // Fallback: built-in model list
  return NextResponse.json([
    { value: "opencode-go/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
    { value: "opencode-go/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
    { value: "opencode-go/minimax-m3-free", label: "MiniMax M3 Free" },
    { value: "opencode-go/kimi-k2.6", label: "Kimi K2.6" },
    { value: "opencode-go/mimo-v2.5-free", label: "Mimo V2.5 Free" },
    { value: "opencode-go/qwen3.6-plus-free", label: "Qwen 3.6 Plus Free" },
    { value: "opencode-go/nemotron-3-super-free", label: "Nemotron 3 Super Free" },
    { value: "opencode-go/big-pickle", label: "Big Pickle" },
  ]);
}
