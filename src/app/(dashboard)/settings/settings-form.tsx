"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw, Pencil, X, Plus } from "lucide-react";
import { updateProfile, changePassword, addUser, saveAgentModels } from "./actions";
import { Button } from "@/components/ui/button";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isAdmin: boolean;
}

interface ListedUser {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  image: string | null;
  createdAt: Date;
}

interface Props {
  user: UserData | null;
  users: ListedUser[];
  isAdmin: boolean;
}

type ModelOption = { value: string; label: string; provider: string };
type Message = { type: "success" | "error"; text: string } | null;

const PROVIDER_LABELS: Record<string, string> = {
  "opencode-zen-free": "OpenCode Zen Free",
  "opencode-go": "OpenCode Go",
};

export function SettingsForm({ user, users, isAdmin }: Props) {
  return (
    <div className="space-y-8">
      <ProfileSection user={user} />
      <AIModelSection />
      {isAdmin && <UsersSection users={users} />}
    </div>
  );
}

/* ── Shared UI ── */

function Banner({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <div
      className={`rounded-lg px-4 py-2.5 text-sm ${
        message.type === "success"
          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border border-red-500/20 bg-red-500/10 text-red-400"
      }`}
    >
      {message.text}
    </div>
  );
}

function initialsOf(name: string | null, email: string) {
  return name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : email.charAt(0).toUpperCase();
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

/* ── Profile Section (view / edit) ── */

function ProfileSection({ user }: { user: UserData | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    const result = await updateProfile(formData);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.success ?? "Actualizado" });
      setEditing(false);
      router.refresh();
    }
    setPending(false);
  }

  const initials = user ? initialsOf(user.name, user.email) : "?";

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Mi cuenta</h2>
          <p className="mt-1 text-sm text-slate-400">Tu información personal</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setEditing(true);
            }}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
        )}
      </div>

      {/* Vista de solo lectura */}
      {!editing && (
        <div className="mt-6 flex items-center gap-4">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt="Avatar"
              className="size-14 rounded-full object-cover ring-2 ring-slate-700"
            />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/20 text-lg font-bold text-amber-400 ring-2 ring-amber-500/30">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-white">
              {user?.name ?? "Sin nombre"}
            </p>
            <p className="truncate text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>
      )}

      {!editing && message && <div className="mt-4">{<Banner message={message} />}</div>}

      {/* Modo edición */}
      {editing && (
        <div className="mt-6 space-y-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-4">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt="Avatar"
                  className="size-14 rounded-full object-cover ring-2 ring-slate-700"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/20 text-lg font-bold text-amber-400 ring-2 ring-amber-500/30">
                  {initials}
                </div>
              )}
              <div className="flex-1">
                <label htmlFor="image" className="mb-1 block text-xs font-medium text-slate-400">
                  URL de avatar (opcional)
                </label>
                <input
                  id="image"
                  name="image"
                  type="url"
                  defaultValue={user?.image ?? ""}
                  className={inputClass}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-medium text-slate-400">
                Nombre
              </label>
              <input id="name" name="name" type="text" required defaultValue={user?.name ?? ""} className={inputClass} />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-400">
                Email
              </label>
              <input id="email" name="email" type="email" required defaultValue={user?.email ?? ""} className={inputClass} />
            </div>

            <Banner message={message} />

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setMessage(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                {pending ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>

          {/* Cambiar contraseña (solo visible al editar) */}
          <PasswordForm />
        </div>
      )}
    </section>
  );
}

/* ── Password form (embedded in profile edit) ── */

function PasswordForm() {
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await changePassword(formData);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.success ?? "Contraseña cambiada" });
      form.reset();
    }
    setPending(false);
  }

  return (
    <div className="border-t border-slate-800 pt-6">
      <h3 className="text-sm font-semibold text-slate-300">Cambiar contraseña</h3>
      <p className="mt-1 text-xs text-slate-500">Usa al menos 6 caracteres. Déjalo en blanco si no quieres cambiarla.</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="currentPassword" className="mb-1 block text-xs font-medium text-slate-400">
            Contraseña actual
          </label>
          <input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" className={inputClass} />
        </div>
        <div>
          <label htmlFor="newPassword" className="mb-1 block text-xs font-medium text-slate-400">
            Nueva contraseña
          </label>
          <input id="newPassword" name="newPassword" type="password" required autoComplete="new-password" className={inputClass} />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-slate-400">
            Confirmar nueva contraseña
          </label>
          <input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" className={inputClass} />
        </div>

        <Banner message={message} />

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}

/* ── AI Model Section ── */

const MODEL_FALLBACK: ModelOption[] = [
  // opencode-zen-free (gratuitos)
  { value: "opencode-zen-free/big-pickle", label: "Big Pickle", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/deepseek-v4-flash-free", label: "DeepSeek V4 Flash (free)", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/mimo-v2.5-free", label: "MiMo V2.5 (free)", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/minimax-m3-free", label: "MiniMax M3 (free)", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/nemotron-3-ultra-free", label: "Nemotron 3 Ultra (free)", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/north-mini-code-free", label: "North Mini Code (free)", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/qwen3.6-plus-free", label: "Qwen 3.6 Plus (free)", provider: "opencode-zen-free" },
  // opencode-go (lista completa)
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

// Modelo aplicado por defecto a todos los agentes mientras no se añada una excepción.
const GLOBAL_DEFAULT_MODEL = "opencode-zen-free/deepseek-v4-flash-free";

const DEFAULT_AGENT_MODELS: Record<string, string> = {
  generator: "opencode-zen-free/deepseek-v4-flash-free",
  skeptic: "opencode-zen-free/deepseek-v4-flash-free",
  defender: "opencode-zen-free/deepseek-v4-flash-free",
  judge: "opencode-zen-free/minimax-m3-free",
  "project-analyst": "opencode-zen-free/deepseek-v4-flash-free",
  "project-naming": "opencode-zen-free/deepseek-v4-flash-free",
  "project-voice": "opencode-zen-free/deepseek-v4-flash-free",
  "project-logo": "opencode-zen-free/deepseek-v4-flash-free",
  "project-template": "opencode-zen-free/deepseek-v4-flash-free",
  "project-content": "opencode-zen-free/deepseek-v4-flash-free",
  "project-business": "opencode-zen-free/deepseek-v4-flash-free",
  "project-execution": "opencode-zen-free/deepseek-v4-flash-free",
};

const AGENT_INFO: { id: string; name: string; description: string }[] = [
  { id: "generator", name: "Generador de ideas", description: "Propone nuevas ideas de negocio a partir de tendencias, mercados y necesidades detectadas." },
  { id: "skeptic", name: "Validador (Escéptico)", description: "Analiza la idea desde una perspectiva crítica, detectando riesgos, debilidades y puntos ciegos." },
  { id: "defender", name: "Validador (Defensor)", description: "Busca argumentos a favor, oportunidades de mercado y ventajas competitivas de la idea." },
  { id: "judge", name: "Juez", description: "Evalúa los argumentos de ambos validadores y emite un veredicto con puntuación final." },
];

const PROJECT_AGENT_INFO: { id: string; name: string; description: string }[] = [
  { id: "project-analyst", name: "Analista de Mercado", description: "Analiza el mercado, competencia, TAM/SAM/SOM y genera estrategia de entrada." },
  { id: "project-business", name: "Estrategia de Negocio", description: "Lean Canvas, modelo de ingresos, pricing y propuesta de valor estratégica." },
  { id: "project-naming", name: "Identidad · Naming", description: "Fase 3 (3a): propone nombres de marca con su significado." },
  { id: "project-voice", name: "Identidad · Voz y Tono", description: "Fase 3 (3b): define personalidad y tono con los Arquetipos de Jung." },
  { id: "project-logo", name: "Identidad · Logo (SVG)", description: "Fase 3 (3c): genera 12 logotipos vectoriales adaptados al sector." },
  { id: "project-template", name: "Identidad · Template visual", description: "Fase 3 (3d): genera 3 templates de componentes web (hero, cards, formularios)." },
  { id: "project-content", name: "Contenido y Publicación", description: "Genera estrategia de contenido, skill de publicación y landing promocional." },
  { id: "project-execution", name: "Roadmap y Ejecución", description: "OKRs 30/60/90, plan financiero y próximos pasos." },
];

type AgentInfo = { id: string; name: string; description: string };
const GROUPS: { key: string; title: string; description: string; agents: AgentInfo[] }[] = [
  { key: "ideas", title: "Ideas", description: "Generación y validación de ideas", agents: AGENT_INFO },
  { key: "projects", title: "Proyectos", description: "Fases de ejecución de proyectos", agents: PROJECT_AGENT_INFO },
];

const ALL_AGENTS: AgentInfo[] = [...AGENT_INFO, ...PROJECT_AGENT_INFO];

const STORAGE_KEY = "brew-ia-agent-models";

function loadModelConfig(): Record<string, string> {
  if (typeof window === "undefined") return DEFAULT_AGENT_MODELS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT_MODELS;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return { ...DEFAULT_AGENT_MODELS, ...parsed };
  } catch {
    return DEFAULT_AGENT_MODELS;
  }
}

function saveModelConfig(config: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// A partir de un config completo {agente: modelo}, deduce el modelo por defecto
// (el más repetido) y las excepciones (agentes que difieren de ese default).
function deriveDefaultAndOverrides(full: Record<string, string>): {
  defaultModel: string;
  overrides: Record<string, string>;
} {
  const counts = new Map<string, number>();
  for (const a of ALL_AGENTS) {
    const m = full[a.id];
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let defaultModel = GLOBAL_DEFAULT_MODEL;
  let max = 0;
  for (const [m, c] of counts) {
    if (c > max) {
      max = c;
      defaultModel = m;
    }
  }
  const overrides: Record<string, string> = {};
  for (const a of ALL_AGENTS) {
    const m = full[a.id];
    if (m && m !== defaultModel) overrides[a.id] = m;
  }
  return { defaultModel, overrides };
}

function AIModelSection() {
  const [defaultModel, setDefaultModel] = useState<string>(GLOBAL_DEFAULT_MODEL);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([...MODEL_FALLBACK]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const { defaultModel: d, overrides: o } = deriveDefaultAndOverrides(loadModelConfig());
    setDefaultModel(d);
    setOverrides(o);
  }, []);

  // Carga la lista de modelos disponibles desde la API (live > fallback).
  const refreshModels = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/settings/available-models", { cache: "no-store" });
      if (!res.ok) throw new Error("Not ok");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setModelOptions(data as ModelOption[]);
      }
    } catch {
      // Mantener la lista de respaldo
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Al abrir Ajustes se actualiza automáticamente
  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  function setOverride(agentId: string, model: string) {
    setOverrides((prev) => ({ ...prev, [agentId]: model }));
    setSaved(false);
  }

  function removeOverride(agentId: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
    setSaved(false);
  }

  function handleDefaultChange(model: string) {
    setDefaultModel(model);
    setSaved(false);
  }

  function handleSave() {
    // Expandir a config completo: cada agente usa su excepción o el modelo por defecto.
    const full: Record<string, string> = {};
    for (const a of ALL_AGENTS) {
      full[a.id] = overrides[a.id] ?? defaultModel;
    }
    saveModelConfig(full);
    saveAgentModels(full).catch((err) => console.error("Failed to persist agent models:", err));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Modelos de IA</h2>
          <p className="mt-1 text-sm text-slate-400">
            Un modelo por defecto para todos los agentes, con excepciones por agente si las necesitas
          </p>
        </div>
        <button
          type="button"
          onClick={refreshModels}
          disabled={refreshing}
          title="Volver a consultar los modelos disponibles"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Actualizando..." : "Actualizar modelos"}
        </button>
      </div>

      {/* Modelo por defecto */}
      <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-amber-300">Modelo por defecto</p>
            <p className="mt-0.5 text-xs text-slate-400">Se aplica a todos los agentes sin excepción</p>
          </div>
          <ModelSelect
            value={defaultModel}
            onChange={handleDefaultChange}
            modelOptions={modelOptions}
            className="sm:w-72 sm:shrink-0"
          />
        </div>
      </div>

      {/* Grupos con excepciones */}
      {GROUPS.map((group) => (
        <ExceptionGroup
          key={group.key}
          group={group}
          defaultModel={defaultModel}
          overrides={overrides}
          modelOptions={modelOptions}
          onSetOverride={setOverride}
          onRemoveOverride={removeOverride}
        />
      ))}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          Guardar configuración
        </button>
        {saved && <span className="animate-in fade-in text-sm text-emerald-400">✓ Guardado</span>}
      </div>
    </section>
  );
}

/* ── Reusable model <select> with provider optgroups ── */
function ModelSelect({
  value,
  onChange,
  modelOptions,
  className = "",
}: {
  value: string;
  onChange: (model: string) => void;
  modelOptions: ModelOption[];
  className?: string;
}) {
  const providers = [...new Set(modelOptions.map((m) => m.provider))];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full max-w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 ${className}`}
    >
      {providers.map((provider) => (
        <optgroup key={provider} label={PROVIDER_LABELS[provider] ?? provider}>
          {modelOptions
            .filter((m) => m.provider === provider)
            .map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

/* ── Collapsible group with per-agent exceptions ── */
function ExceptionGroup({
  group,
  defaultModel,
  overrides,
  modelOptions,
  onSetOverride,
  onRemoveOverride,
}: {
  group: { key: string; title: string; description: string; agents: AgentInfo[] };
  defaultModel: string;
  overrides: Record<string, string>;
  modelOptions: ModelOption[];
  onSetOverride: (id: string, model: string) => void;
  onRemoveOverride: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const exceptions = group.agents.filter((a) => overrides[a.id] != null);
  const available = group.agents.filter((a) => overrides[a.id] == null);
  const labelFor = (value: string) => modelOptions.find((m) => m.value === value)?.label ?? value;

  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/30">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-800/30"
      >
        <div className="flex items-center gap-3">
          <ChevronRight className={`size-4 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
          <div>
            <p className="text-sm font-medium text-white">{group.title}</p>
            <p className="text-xs text-slate-500">{group.description}</p>
          </div>
        </div>
        <span className="text-xs text-slate-400">
          {exceptions.length > 0
            ? `${exceptions.length} excepci${exceptions.length === 1 ? "ón" : "ones"}`
            : "Por defecto"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-800 px-4 py-4">
          {exceptions.length === 0 && (
            <p className="text-xs text-slate-500">
              Todos los agentes de este grupo usan el modelo por defecto ({labelFor(defaultModel)}).
            </p>
          )}

          {/* Excepciones actuales */}
          {exceptions.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{agent.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{agent.description}</p>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                <ModelSelect
                  value={overrides[agent.id]}
                  onChange={(model) => onSetOverride(agent.id, model)}
                  modelOptions={modelOptions}
                  className="sm:w-56"
                />
                <button
                  type="button"
                  onClick={() => onRemoveOverride(agent.id)}
                  title="Quitar excepción (volver al modelo por defecto)"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Añadir excepción */}
          {available.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-700 px-4 py-3">
              <Plus className="size-4 shrink-0 text-slate-400" />
              <span className="text-sm text-slate-300">Añadir excepción</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onSetOverride(e.target.value, defaultModel);
                }}
                className="w-full max-w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none sm:ml-auto sm:w-auto"
              >
                <option value="" disabled>
                  Seleccionar agente...
                </option>
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Users Section (Admin only) ── */

function UsersSection({ users }: { users: ListedUser[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Usuarios</h2>
          <p className="mt-1 text-sm text-slate-400">Gestiona quién tiene acceso a BrewIdea</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />
          Añadir usuario
        </button>
      </div>

      {/* User list */}
      <div className="mt-6 space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
          >
            {u.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.image} alt="" className="size-8 rounded-full object-cover" />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                {initialsOf(u.name, u.email)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{u.name ?? "Sin nombre"}</p>
              <p className="truncate text-xs text-slate-400">{u.email}</p>
            </div>
            {u.isAdmin && (
              <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                Admin
              </span>
            )}
          </div>
        ))}

        {users.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">No hay usuarios</p>
        )}
      </div>

      {modalOpen && (
        <AddUserModal
          onClose={() => setModalOpen(false)}
          onAdded={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

/* ── Add user modal ── */
function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    const result = await addUser(formData);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      setPending(false);
    } else {
      onAdded();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base font-semibold text-white">Añadir nuevo usuario</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="newUserName" className="mb-1 block text-xs font-medium text-slate-400">
                Nombre
              </label>
              <input id="newUserName" name="name" type="text" required autoComplete="off" className={inputClass} placeholder="Nombre" />
            </div>
            <div>
              <label htmlFor="newUserEmail" className="mb-1 block text-xs font-medium text-slate-400">
                Email
              </label>
              <input id="newUserEmail" name="email" type="email" required autoComplete="off" className={inputClass} placeholder="usuario@email.com" />
            </div>
          </div>
          <div>
            <label htmlFor="tempPassword" className="mb-1 block text-xs font-medium text-slate-400">
              Contraseña temporal
            </label>
            <input id="tempPassword" name="tempPassword" type="password" required autoComplete="new-password" className={inputClass} placeholder="Mínimo 6 caracteres" />
          </div>

          <Banner message={message} />

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {pending ? "Añadiendo..." : "Añadir usuario"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
