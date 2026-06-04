import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// ── OpenClaw Zen free + OpenCode Go model catalog ─────────────────

interface ModelOption {
  value: string;
  label: string;
  provider: string;
}

interface RawModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

// Labels for models where the auto-generated label from the ID is suboptimal
const MODEL_LABELS: Record<string, string> = {
  "big-pickle": "Big Pickle",
  "deepseek-v4-flash-free": "DeepSeek V4 Flash (free)",
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "mimo-v2.5-free": "MiMo V2.5 (free)",
  "mimo-v2.5": "MiMo V2.5",
  "mimo-v2.5-pro": "MiMo V2.5 Pro",
  "mimo-v2-pro": "MiMo V2 Pro",
  "mimo-v2-omni": "MiMo V2 Omni",
  "minimax-m3-free": "MiniMax M3 (free)",
  "minimax-m3": "MiniMax M3",
  "minimax-m2.5": "MiniMax M2.5",
  "minimax-m2.7": "MiniMax M2.7",
  "nemotron-3-super-free": "Nemotron 3 Super (free)",
  "qwen3.6-plus-free": "Qwen 3.6 Plus (free)",
  "qwen3.6-plus": "Qwen 3.6 Plus",
  "qwen3.5-plus": "Qwen 3.5 Plus",
  "qwen3.7-plus": "Qwen 3.7 Plus",
  "qwen3.7-max": "Qwen 3.7 Max",
  "kimi-k2.6": "Kimi K2.6",
  "kimi-k2.5": "Kimi K2.5",
  "glm-5.1": "GLM 5.1",
  "glm-5": "GLM 5",
  "hy3-preview": "HY3 Preview",
};

// ── opencode-zen-free models (6) ────────────────────────────────
const ZEN_FREE_MODELS: ModelOption[] = [
  {
    value: "opencode-zen-free/big-pickle",
    label: "Big Pickle",
    provider: "opencode-zen-free",
  },
  {
    value: "opencode-zen-free/deepseek-v4-flash-free",
    label: "DeepSeek V4 Flash (free)",
    provider: "opencode-zen-free",
  },
  {
    value: "opencode-zen-free/mimo-v2.5-free",
    label: "MiMo V2.5 (free)",
    provider: "opencode-zen-free",
  },
  {
    value: "opencode-zen-free/minimax-m3-free",
    label: "MiniMax M3 (free)",
    provider: "opencode-zen-free",
  },
  {
    value: "opencode-zen-free/nemotron-3-super-free",
    label: "Nemotron 3 Super (free)",
    provider: "opencode-zen-free",
  },
  {
    value: "opencode-zen-free/qwen3.6-plus-free",
    label: "Qwen 3.6 Plus (free)",
    provider: "opencode-zen-free",
  },
];

// ── opencode-go fallback models (18) — in case the live endpoint is unreachable
const GO_MODELS_FALLBACK: ModelOption[] = [
  { value: "opencode-go/deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "opencode-go" },
  { value: "opencode-go/deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "opencode-go" },
  { value: "opencode-go/qwen3.5-plus", label: "Qwen 3.5 Plus", provider: "opencode-go" },
  { value: "opencode-go/qwen3.6-plus", label: "Qwen 3.6 Plus", provider: "opencode-go" },
  { value: "opencode-go/qwen3.7-plus", label: "Qwen 3.7 Plus", provider: "opencode-go" },
  { value: "opencode-go/qwen3.7-max", label: "Qwen 3.7 Max", provider: "opencode-go" },
  { value: "opencode-go/kimi-k2.5", label: "Kimi K2.5", provider: "opencode-go" },
  { value: "opencode-go/kimi-k2.6", label: "Kimi K2.6", provider: "opencode-go" },
  { value: "opencode-go/glm-5", label: "GLM 5", provider: "opencode-go" },
  { value: "opencode-go/glm-5.1", label: "GLM 5.1", provider: "opencode-go" },
  { value: "opencode-go/minimax-m2.5", label: "MiniMax M2.5", provider: "opencode-go" },
  { value: "opencode-go/minimax-m2.7", label: "MiniMax M2.7", provider: "opencode-go" },
  { value: "opencode-go/minimax-m3", label: "MiniMax M3", provider: "opencode-go" },
  { value: "opencode-go/mimo-v2.5", label: "MiMo V2.5", provider: "opencode-go" },
  { value: "opencode-go/mimo-v2.5-pro", label: "MiMo V2.5 Pro", provider: "opencode-go" },
  { value: "opencode-go/mimo-v2-pro", label: "MiMo V2 Pro", provider: "opencode-go" },
  { value: "opencode-go/mimo-v2-omni", label: "MiMo V2 Omni", provider: "opencode-go" },
  { value: "opencode-go/hy3-preview", label: "HY3 Preview", provider: "opencode-go" },
];

// Path to the bridge's available-models.json (legacy, for local runs)
const AVAILABLE_MODELS_PATH = path.resolve(
  process.env.HOME || "/root",
  ".openclaw/credentials/available-models.json"
);

function humanizeModelId(id: string): string {
  return (
    MODEL_LABELS[id] ??
    id
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
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
      const provider = m.owned_by === "opencode" ? "opencode-zen-free" : m.owned_by ?? "opencode-zen-free";
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

async function fetchGoModels(): Promise<ModelOption[] | null> {
  try {
    const apiKey = process.env.OPENCODE_API_KEY;
    if (!apiKey) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch("https://opencode.ai/zen/go/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.data || !Array.isArray(data.data)) return null;

    return data.data
      .filter((m: RawModel) => m.id)
      .map((m: RawModel) => ({
        value: `opencode-go/${m.id}`,
        label: humanizeModelId(m.id),
        provider: "opencode-go",
      }));
  } catch {
    return null;
  }
}

// GET /api/settings/available-models — public, no auth required
// Returns the list of available AI models (zen-free + opencode-go).
export async function GET() {
  const zenModels = readAvailableModels();

  // Fetch opencode-go models from live endpoint, fall back to hardcoded list
  const goModels = (await fetchGoModels()) ?? GO_MODELS_FALLBACK;

  const seen = new Set<string>();
  const merged: ModelOption[] = [];

  // File models first (live from system — zen-free)
  if (zenModels && zenModels.length > 0) {
    for (const m of zenModels) {
      if (!seen.has(m.value)) {
        seen.add(m.value);
        merged.push(m);
      }
    }
  } else {
    // No file available: use hardcoded zen-free list
    for (const m of ZEN_FREE_MODELS) {
      if (!seen.has(m.value)) {
        seen.add(m.value);
        merged.push(m);
      }
    }
  }

  // Add opencode-go models
  for (const m of goModels) {
    if (!seen.has(m.value)) {
      seen.add(m.value);
      merged.push(m);
    }
  }

  merged.sort((a, b) =>
    a.provider.localeCompare(b.provider) || a.label.localeCompare(b.label)
  );

  return NextResponse.json(merged);
}
