import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// La lista se sirve siempre fresca: se consulta en vivo a opencode.ai en cada
// petición (sin caché de Next), de modo que al abrir Ajustes —o pulsar el botón
// "Actualizar"— se reflejan los modelos disponibles del momento.
export const dynamic = "force-dynamic";

// ── OpenClaw Zen free + OpenCode Go model catalog ─────────────────

interface ModelOption {
  value: string;
  label: string;
  provider: string;
  reasoning?: boolean;
}

interface RawModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  deprecated?: boolean;
  deprecation?: unknown;
  status?: string;
}

// Un modelo está "en desuso" si la API lo marca con cualquiera de estos campos.
function isDeprecated(m: RawModel): boolean {
  return (
    m.deprecated === true ||
    m.deprecation != null ||
    m.status === "deprecated"
  );
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
  "nemotron-3-ultra-free": "Nemotron 3 Ultra (free)",
  "north-mini-code-free": "North Mini Code (free)",
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
    value: "opencode-zen-free/nemotron-3-ultra-free",
    label: "Nemotron 3 Ultra (free)",
    provider: "opencode-zen-free",
  },
  {
    value: "opencode-zen-free/north-mini-code-free",
    label: "North Mini Code (free)",
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

// ── Brew agent allowlist (fuente autoritativa en el VPS) ─────────
// Estructura: { providers: { [providerKey]: { models: [{ id, name, reasoning }] } } }
interface BrewAllowlistModel {
  id?: string;
  name?: string;
  reasoning?: boolean;
}
interface BrewAllowlist {
  providers?: Record<string, { models?: BrewAllowlistModel[] }>;
}

// Lee el allowlist del agente brew si BREW_MODELS_PATH está definido y el
// archivo existe/parsea. Devuelve la lista de modelos USABLES (con su capacidad
// de razonamiento) o null si no se puede usar (para caer al comportamiento dev).
function readBrewAllowlist(): ModelOption[] | null {
  try {
    const allowlistPath = process.env.BREW_MODELS_PATH;
    if (!allowlistPath) return null;
    if (!fs.existsSync(allowlistPath)) return null;
    const raw = fs.readFileSync(allowlistPath, "utf-8");
    const parsed = JSON.parse(raw) as BrewAllowlist;
    const providers = parsed?.providers;
    if (!providers || typeof providers !== "object") return null;

    const models: ModelOption[] = [];
    for (const [provider, entry] of Object.entries(providers)) {
      const list = entry?.models;
      if (!Array.isArray(list)) continue;
      for (const m of list) {
        if (!m?.id) continue;
        models.push({
          value: `${provider}/${m.id}`,
          label: m.name || humanizeModelId(m.id),
          provider,
          reasoning: !!m.reasoning,
        });
      }
    }
    return models.length > 0 ? models : null;
  } catch {
    return null;
  }
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

// Descarga la lista cruda de modelos de un endpoint de opencode.ai.
// El endpoint es público; se envía el Bearer solo si hay API key disponible.
async function fetchRawModels(url: string): Promise<RawModel[] | null> {
  try {
    const apiKey = process.env.OPENCODE_API_KEY;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.data || !Array.isArray(data.data)) return null;
    return data.data as RawModel[];
  } catch {
    return null;
  }
}

// Lista completa de opencode-go (todos los modelos no deprecados).
async function fetchGoModels(): Promise<ModelOption[] | null> {
  const raw = await fetchRawModels("https://opencode.ai/zen/go/v1/models");
  if (!raw) return null;
  return raw
    .filter((m) => m.id && !isDeprecated(m))
    .map((m) => ({
      value: `opencode-go/${m.id}`,
      label: humanizeModelId(m.id),
      provider: "opencode-go",
    }));
}

// Modelos gratuitos cuyo id no acaba en "-free" pero sí lo son (excepciones).
const ZEN_FREE_EXTRA_IDS = new Set(["big-pickle"]);

// Modelos gratuitos de opencode-zen: id que acaba en "-free" (o excepción) y no deprecado.
async function fetchZenFreeModels(): Promise<ModelOption[] | null> {
  const raw = await fetchRawModels("https://opencode.ai/zen/v1/models");
  if (!raw) return null;
  const free = raw.filter(
    (m) =>
      m.id &&
      (m.id.endsWith("-free") || ZEN_FREE_EXTRA_IDS.has(m.id)) &&
      !isDeprecated(m)
  );
  if (free.length === 0) return null;
  return free.map((m) => ({
    value: `opencode-zen-free/${m.id}`,
    label: humanizeModelId(m.id),
    provider: "opencode-zen-free",
  }));
}

// GET /api/settings/available-models — public, no auth required
// Returns the list of available AI models (zen-free + opencode-go).
export async function GET() {
  // Si el allowlist del agente brew está disponible (VPS), es la lista
  // AUTORITATIVA: son los únicos modelos usables, con su capacidad de
  // razonamiento. No se mezcla con el catálogo amplio de opencode-go/zen.
  const brewModels = readBrewAllowlist();
  if (brewModels) {
    brewModels.sort(
      (a, b) =>
        a.provider.localeCompare(b.provider) || a.label.localeCompare(b.label)
    );
    return NextResponse.json(brewModels);
  }

  // Fallback (dev local): zen-free: archivo local (VPS) > endpoint en vivo > lista fija de respaldo
  const zenModels =
    readAvailableModels() ?? (await fetchZenFreeModels()) ?? ZEN_FREE_MODELS;

  // opencode-go: endpoint en vivo > lista fija de respaldo
  const goModels = (await fetchGoModels()) ?? GO_MODELS_FALLBACK;

  const seen = new Set<string>();
  const merged: ModelOption[] = [];

  // zen-free primero
  for (const m of zenModels) {
    if (!seen.has(m.value)) {
      seen.add(m.value);
      merged.push(m);
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
