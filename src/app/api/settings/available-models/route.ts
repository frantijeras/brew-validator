import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// ── Full OpenClaw Zen model catalog ──────────────────────────────

interface ModelOption {
  value: string;
  label: string;
  provider: string;
}

// Labels for models where the auto-generated label from the ID is suboptimal
const MODEL_LABELS: Record<string, string> = {
  "big-pickle": "Big Pickle",
  "deepseek-v4-flash-free": "DeepSeek V4 Flash (free)",
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "mimo-v2.5-free": "MiMo V2.5 (free)",
  "minimax-m3-free": "MiniMax M3 (free)",
  "nemotron-3-super-free": "Nemotron 3 Super (free)",
  "qwen3.6-plus-free": "Qwen 3.6 Plus (free)",
  "qwen3.7-plus": "Qwen 3.7 Plus",
  "qwen3.7-max": "Qwen 3.7 Max",
  "kimi-k2.6": "Kimi K2.6",
  "claude-opus-4-8": "Claude Opus 4.8",
  "claude-opus-4-7": "Claude Opus 4.7",
  "claude-opus-4-6": "Claude Opus 4.6",
  "claude-opus-4-5": "Claude Opus 4.5",
  "claude-opus-4-1": "Claude Opus 4.1",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-sonnet-4-5": "Claude Sonnet 4.5",
  "claude-sonnet-4": "Claude Sonnet 4",
  "claude-haiku-4-5": "Claude Haiku 4.5",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-3.1-pro": "Gemini 3.1 Pro",
  "gemini-3-flash": "Gemini 3 Flash",
  "gpt-5.5": "GPT-5.5",
  "gpt-5.5-pro": "GPT-5.5 Pro",
  "gpt-5.4": "GPT-5.4",
  "gpt-5.4-pro": "GPT-5.4 Pro",
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gpt-5.4-nano": "GPT-5.4 Nano",
  "gpt-5.2": "GPT-5.2",
  "gpt-5": "GPT-5",
  "gpt-5-mini": "GPT-5 Mini",
};

// ── All known OpenClaw Zen models (46 total) ─────────────────────

const ALL_MODELS: ModelOption[] = [
  // ── opencode-zen-free (6) ──
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

  // ── opencode-zen — Claude (9) ──
  {
    value: "opencode-zen/claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/claude-opus-4-7",
    label: "Claude Opus 4.7",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/claude-opus-4-5",
    label: "Claude Opus 4.5",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/claude-opus-4-1",
    label: "Claude Opus 4.1",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "opencode-zen",
  },

  // ── opencode-zen — Gemini (3) ──
  {
    value: "opencode-zen/gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gemini-3.1-pro",
    label: "Gemini 3.1 Pro",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gemini-3-flash",
    label: "Gemini 3 Flash",
    provider: "opencode-zen",
  },

  // ── opencode-zen — GPT (9) ──
  {
    value: "opencode-zen/gpt-5.5",
    label: "GPT-5.5",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gpt-5.5-pro",
    label: "GPT-5.5 Pro",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gpt-5.4",
    label: "GPT-5.4",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gpt-5.4-pro",
    label: "GPT-5.4 Pro",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gpt-5.4-nano",
    label: "GPT-5.4 Nano",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gpt-5.2",
    label: "GPT-5.2",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gpt-5",
    label: "GPT-5",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/gpt-5-mini",
    label: "GPT-5 Mini",
    provider: "opencode-zen",
  },

  // ── opencode-zen — DeepSeek (2) ──
  {
    value: "opencode-zen/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: "opencode-zen",
  },

  // ── opencode-zen — Kimi (1) ──
  {
    value: "opencode-zen/kimi-k2.6",
    label: "Kimi K2.6",
    provider: "opencode-zen",
  },

  // ── opencode-zen — Qwen (2) ──
  {
    value: "opencode-zen/qwen3.7-max",
    label: "Qwen 3.7 Max",
    provider: "opencode-zen",
  },
  {
    value: "opencode-zen/qwen3.7-plus",
    label: "Qwen 3.7 Plus",
    provider: "opencode-zen",
  },
];

// Path to the bridge's available-models.json (legacy, for local runs)
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

// GET /api/settings/available-models — public, no auth required
// Returns the full list of available AI models for the settings selector.
export async function GET() {
  const zenModels = readAvailableModels();

  // File exists locally: merge file models with hardcoded list (deduped by value)
  if (zenModels && zenModels.length > 0) {
    const seen = new Set<string>();
    const merged: ModelOption[] = [];

    // File models first (live from system)
    for (const m of zenModels) {
      if (!seen.has(m.value)) {
        seen.add(m.value);
        merged.push(m);
      }
    }

    // Then hardcoded list (adds opencode-zen paid models not in the file)
    for (const m of ALL_MODELS) {
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

  // No file available (production/Vercel): return full hardcoded catalog
  return NextResponse.json(ALL_MODELS);
}
