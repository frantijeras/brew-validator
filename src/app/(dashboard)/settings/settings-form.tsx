"use client";

import { useState, useEffect } from "react";
import { updateProfile, changePassword, addUser, saveAgentModels } from "./actions";

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

export function SettingsForm({ user, users, isAdmin }: Props) {
  return (
    <div className="space-y-8">
      <ProfileSection user={user} />
      <PasswordSection />
      <AIModelSection />
      {isAdmin && <UsersSection users={users} />}
    </div>
  );
}

/* ── Profile Section ── */

function ProfileSection({ user }: { user: UserData | null }) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    const result = await updateProfile(formData);
    setMessage(result.error
      ? { type: "error", text: result.error }
      : { type: "success", text: result.success ?? "Actualizado" });
    setPending(false);
  }

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-white">Mi cuenta</h2>
      <p className="mt-1 text-sm text-slate-400">Tu información personal</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          {user?.image ? (
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
            <label
              htmlFor="image"
              className="mb-1 block text-xs font-medium text-slate-400"
            >
              URL de avatar (opcional)
            </label>
            <input
              id="image"
              name="image"
              type="url"
              defaultValue={user?.image ?? ""}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Nombre
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={user?.name ?? ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={user?.email ?? ""}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {message && (
          <div
            className={`rounded-lg px-4 py-2.5 text-sm ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </section>
  );
}

/* ── Password Section ── */

function PasswordSection() {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    const result = await changePassword(formData);
    setMessage(result.error
      ? { type: "error", text: result.error }
      : { type: "success", text: result.success ?? "Contraseña cambiada" });
    if (!result.error) {
      e.currentTarget.reset();
    }
    setPending(false);
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-white">Cambiar contraseña</h2>
      <p className="mt-1 text-sm text-slate-400">
        Usa al menos 6 caracteres
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="currentPassword"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Contraseña actual
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Nueva contraseña
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Confirmar nueva contraseña
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {message && (
          <div
            className={`rounded-lg px-4 py-2.5 text-sm ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {pending ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </form>
    </section>
  );
}

/* ── AI Model Section ── */

const MODEL_FALLBACK: ModelOption[] = [
  // opencode-zen-free
  { value: "opencode-zen-free/big-pickle", label: "Big Pickle", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/deepseek-v4-flash-free", label: "DeepSeek V4 Flash (free)", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/mimo-v2.5-free", label: "MiMo V2.5 (free)", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/minimax-m3-free", label: "MiniMax M3 (free)", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/nemotron-3-super-free", label: "Nemotron 3 Super (free)", provider: "opencode-zen-free" },
  { value: "opencode-zen-free/qwen3.6-plus-free", label: "Qwen 3.6 Plus (free)", provider: "opencode-zen-free" },
  // opencode-go
  { value: "opencode-go/deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "opencode-go" },
  { value: "opencode-go/deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "opencode-go" },
  { value: "opencode-go/kimi-k2.6", label: "Kimi K2.6", provider: "opencode-go" },
  { value: "opencode-go/glm-5.1", label: "GLM 5.1", provider: "opencode-go" },
  { value: "opencode-go/minimax-m3", label: "MiniMax M3", provider: "opencode-go" },
  { value: "opencode-go/qwen3.7-max", label: "Qwen 3.7 Max", provider: "opencode-go" },
];

type ModelOption = { value: string; label: string; provider: string };

const DEFAULT_AGENT_MODELS: Record<string, string> = {
  "generator": "opencode-zen-free/deepseek-v4-flash-free",
  "skeptic": "opencode-zen-free/deepseek-v4-flash-free",
  "defender": "opencode-zen-free/deepseek-v4-flash-free",
  "judge": "opencode-zen-free/minimax-m3-free",
  "refiner": "opencode-zen-free/deepseek-v4-flash-free",
  "project-analyst": "opencode-zen-free/deepseek-v4-flash-free",
  "project-branding": "opencode-zen-free/deepseek-v4-flash-free",
  "project-content": "opencode-zen-free/deepseek-v4-flash-free",
  "project-dev": "opencode-zen-free/deepseek-v4-flash-free",
  "project-dossier": "opencode-zen-free/deepseek-v4-flash-free",
};

const AGENT_INFO: { id: string; name: string; description: string }[] = [
  {
    id: "generator",
    name: "Generador de ideas",
    description: "Propone nuevas ideas de negocio a partir de tendencias, mercados y necesidades detectadas.",
  },
  {
    id: "skeptic",
    name: "Validador (Escéptico)",
    description: "Analiza la idea desde una perspectiva crítica, detectando riesgos, debilidades y puntos ciegos.",
  },
  {
    id: "defender",
    name: "Validador (Defensor)",
    description: "Busca argumentos a favor, oportunidades de mercado y ventajas competitivas de la idea.",
  },
  {
    id: "judge",
    name: "Juez",
    description: "Evalúa los argumentos de ambos validadores y emite un veredicto con puntuación final.",
  },
  {
    id: "refiner",
    name: "Refinador (QA)",
    description: "Pule la idea final, mejora la redacción y asegura la calidad del resultado.",
  },
];

const PROJECT_AGENT_INFO: { id: string; name: string; description: string }[] = [
  {
    id: "project-analyst",
    name: "Analista de Mercado",
    description: "Analiza el mercado, competencia, TAM/SAM/SOM y genera estrategia de entrada.",
  },
  {
    id: "project-branding",
    name: "Branding / Identidad",
    description: "Define naming, tono de voz, personalidad y estilo visual del proyecto.",
  },
  {
    id: "project-content",
    name: "Contenido y Publicación",
    description: "Genera estrategia de contenido, skill de publicación y landing promocional.",
  },
  {
    id: "project-dev",
    name: "Desarrollo Técnico",
    description: "Plan técnico, stack, arquitectura y skill de desarrollo con contexto completo.",
  },
  {
    id: "project-dossier",
    name: "Dossier Completo",
    description: "Compila todo el proyecto en un documento único y ejecutable.",
  },
];

const STORAGE_KEY = "brew-ia-agent-models";

function loadModelConfig(): Record<string, string> {
  if (typeof window === "undefined") return DEFAULT_AGENT_MODELS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT_MODELS;
    const parsed = JSON.parse(raw) as Record<string, string>;
    // Merge with defaults so that new agents always have a fallback
    return { ...DEFAULT_AGENT_MODELS, ...parsed };
  } catch {
    return DEFAULT_AGENT_MODELS;
  }
}

function saveModelConfig(config: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function AIModelSection() {
  const [config, setConfig] = useState<Record<string, string>>(DEFAULT_AGENT_MODELS);
  const [saved, setSaved] = useState(false);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([...MODEL_FALLBACK]);

  useEffect(() => {
    setConfig(loadModelConfig());
  }, []);

  // Fetch available models from API, fallback to hardcoded list
  useEffect(() => {
    fetch("/api/settings/available-models")
      .then((res) => {
        if (!res.ok) throw new Error("Not ok");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setModelOptions(data as ModelOption[]);
        }
      })
      .catch(() => {
        // Keep fallback models
      });
  }, []);

  function handleChange(agentId: string, model: string) {
    setConfig((prev) => ({ ...prev, [agentId]: model }));
    setSaved(false);
  }

  function handleSave() {
    saveModelConfig(config);
    // Also persist to server for bridge daemon
    saveAgentModels(config).catch((err) => console.error("Failed to persist agent models:", err));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-white">Modelos de IA</h2>
      <p className="mt-1 text-sm text-slate-400">
        Asigna un modelo de lenguaje a cada agente del validador
      </p>

      <div className="mt-6 space-y-4">
        {AGENT_INFO.map((agent) => (
          <AgentSelectRow key={agent.id} agent={agent} config={config} modelOptions={modelOptions} onChange={handleChange} />
        ))}
      </div>

      {/* Project agents — visually separated */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Proyectos
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Modelos para las fases de ejecución de proyectos
        </p>
        <div className="mt-3 space-y-4">
          {PROJECT_AGENT_INFO.map((agent) => (
            <AgentSelectRow key={agent.id} agent={agent} config={config} modelOptions={modelOptions} onChange={handleChange} />
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          Guardar configuración
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 animate-in fade-in">
            ✓ Guardado
          </span>
        )}
      </div>
    </section>
  );
}

/* ── Users Section (Admin only) ── */

function UsersSection({ users }: { users: ListedUser[] }) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    const result = await addUser(formData);
    setMessage(result.error
      ? { type: "error", text: result.error }
      : { type: "success", text: result.success ?? "Usuario añadido" });
    if (!result.error) {
      e.currentTarget.reset();
    }
    setPending(false);
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-white">Usuarios</h2>
      <p className="mt-1 text-sm text-slate-400">
        Gestiona quién tiene acceso a BrewIdea
      </p>

      {/* User list */}
      <div className="mt-6 space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
          >
            {u.image ? (
              <img
                src={u.image}
                alt=""
                className="size-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                {u.name
                  ? u.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                  : u.email.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {u.name ?? "Sin nombre"}
              </p>
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
          <p className="py-4 text-center text-sm text-slate-500">
            No hay usuarios
          </p>
        )}
      </div>

      {/* Add user form */}
      <div className="mt-6 border-t border-slate-800 pt-6">
        <h3 className="text-sm font-semibold text-slate-300">
          Añadir nuevo usuario
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="newUserName"
                className="mb-1 block text-xs font-medium text-slate-400"
              >
                Nombre
              </label>
              <input
                id="newUserName"
                name="name"
                type="text"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Nombre"
              />
            </div>
            <div>
              <label
                htmlFor="newUserEmail"
                className="mb-1 block text-xs font-medium text-slate-400"
              >
                Email
              </label>
              <input
                id="newUserEmail"
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="usuario@email.com"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="tempPassword"
              className="mb-1 block text-xs font-medium text-slate-400"
            >
              Contraseña temporal
            </label>
            <input
              id="tempPassword"
              name="tempPassword"
              type="password"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {message && (
            <div
              className={`rounded-lg px-4 py-2.5 text-sm ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {pending ? "Añadiendo..." : "Añadir usuario"}
          </button>
        </form>
      </div>
    </section>
  );
}

/* ── Agent select row (reusable) ── */
function AgentSelectRow({
  agent,
  config,
  modelOptions,
  onChange,
}: {
  agent: { id: string; name: string; description: string };
  config: Record<string, string>;
  modelOptions: { value: string; label: string; provider: string }[];
  onChange: (id: string, model: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{agent.name}</p>
        <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
          {agent.description}
        </p>
      </div>
      <select
        value={config[agent.id] ?? DEFAULT_AGENT_MODELS[agent.id]}
        onChange={(e) => onChange(agent.id, e.target.value)}
        className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      >
        {(() => {
          const providers = [...new Set(modelOptions.map((m) => m.provider))];
          const providerLabels: Record<string, string> = {
            "opencode-zen-free": "OpenCode Zen Free",
            "opencode-go": "OpenCode Go",
          };
          return providers.map((provider) => (
            <optgroup key={provider} label={providerLabels[provider] ?? provider}>
              {modelOptions
                .filter((m) => m.provider === provider)
                .map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
            </optgroup>
          ));
        })()}
      </select>
    </div>
  );
}
