import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const AVAILABLE_MODELS_PATH = path.resolve(
  process.env.HOME || "/root",
  ".openclaw/credentials/available-models.json"
);

interface RawModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

interface ModelOption {
  value: string;
  label: string;
  provider: string;
}

const MODEL_LABELS: Record<string, string> = {
  "big-pickle": "Big Pickle",
  "deepseek-v4-flash-free": "DS V4 Flash Free",
  "deepseek-v4-flash": "DS V4 Flash",
  "deepseek-v4-pro": "DS V4 Pro",
  "mimo-v2.5-free": "MiMo V2.5 Free",
  "minimax-m3-free": "MiniMax M3 Free",
  "nemotron-3-super-free": "Nemotron 3 Free",
  "qwen3.6-plus-free": "Qwen3.6 Plus Free",
  "kimi-k2.6": "Kimi K2.6",
};

// opencode-go models (not in available-models.json, always included)
const OPENCODE_GO_MODELS: ModelOption[] = [
  {
    value: "opencode-go/deepseek-v4-flash",
    label: "DS V4 Flash",
    provider: "opencode-go",
  },
  {
    value: "opencode-go/deepseek-v4-pro",
    label: "DS V4 Pro",
    provider: "opencode-go",
  },
  {
    value: "opencode-go/kimi-k2.6",
    label: "Kimi K2.6",
    provider: "opencode-go",
  },
];

function humanizeModelId(id: string): string {
  return MODEL_LABELS[id] ?? id
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readAvailableModels(): ModelOption[] | null {
  try {
    if (!fs.existsSync(AVAILABLE_MODELS_PATH)) return null;
    const raw = fs.readFileSync(AVAILABLE_MODELS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as RawModel[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const models: ModelOption[] = [];
    for (const m of parsed) {
      if (!m.id) continue;
      const provider = m.owned_by === "opencode"
        ? "opencode-zen-free"
        : (m.owned_by ?? "opencode-zen-free");
      models.push({
        value: `${provider}/${m.id}`,
        label: humanizeModelId(m.id),
        provider,
      });
    }
    return models;
  } catch {
    return null;
  }
}

// Full fallback when available-models.json is not present (e.g. Vercel production)
const FULL_FALLBACK: ModelOption[] = [
  // opencode-zen-free
  { value: "opencode-zen-free/big-pickle", label: "Big Pickle", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/deepseek-v4-flash-free", label: "DS V4 Flash Free", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/mimo-v2.5-free", label: "MiMo V2.5 Free", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/minimax-m3-free", label: "MiniMax M3 Free", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/nemotron-3-super-free", label: "Nemotron 3 Free", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/qwen3.6-plus-free", label: "Qwen3.6 Plus Free", provider: "opencode-zen-free" },
  // opencode-go
  ...OPENCODE_GO_MODELS,
];

// GET /api/settings/available-models — public, no auth required
// Returns the full list of available AI models for the settings selector.
export async function GET() {
  const zenModels = readAvailableModels();

  // File exists locally: use real models from available-models.json + opencode-go
  if (zenModels && zenModels.length > 0) {
    const allModels: ModelOption[] = [...zenModels, ...OPENCODE_GO_MODELS];
    allModels.sort((a, b) =>
      a.provider.localeCompare(b.provider) || a.label.localeCompare(b.label)
    );
    return NextResponse.json(allModels);
  }

  // No file available (production/Vercel): return full hardcoded fallback
  return NextResponse.json(FULL_FALLBACK);
}
