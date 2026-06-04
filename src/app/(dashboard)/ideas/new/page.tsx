"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dices, Target, Shuffle } from "lucide-react";
import { BusinessModelIcon } from "@/components/business-model-icon";
import { BUSINESS_MODELS } from "@/lib/business-models";

type Mode = "random" | "custom" | null;

export default function NewIdeaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  async function generateIdea(body: object) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al generar la idea");
      }

      const { ideaId } = await res.json();
      router.push("/ideas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/ideas"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeftIcon />
          Volver a ideas
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Nueva idea
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Elige cómo quieres generar tu idea de negocio.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => {
              setError("");
              setMode(null);
            }}
            className="mt-3 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Volver a elegir modo
          </button>
        </div>
      )}

      {/* ── Step 1: Choose mode (dropdown) ── */}
      {mode === null && !error && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <label
            htmlFor="mode-select"
            className="mb-3 block text-sm font-medium text-slate-300"
          >
            ¿Cómo quieres generar tu idea?
          </label>
          <select
            id="mode-select"
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (val === "random" || val === "custom") setMode(val);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10"
          >
            <option value="" disabled>
              Selecciona un modo...
            </option>
            <option value="random">Idea aleatoria</option>
            <option value="custom">Idea personalizada</option>
          </select>
        </div>
      )}

      {/* ── Random Mode ── */}
      {mode === "random" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <button
            onClick={() => setMode(null)}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeftIcon />
            Elegir otro modo
          </button>

          <div className="mb-4 flex justify-center">
            <Dices className="size-12 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">
            Idea aleatoria
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Se generará una idea de negocio a partir de tendencias de
            mercado actuales usando IA. Puedes validarla después.
          </p>

          <div className="mt-6 text-left">
            <p className="mb-3 text-xs font-medium text-slate-400">
              Tipo de idea:
            </p>
            <BusinessModelSelector
              selected={selectedModel}
              onChange={setSelectedModel}
            />
          </div>

          <button
            onClick={() => generateIdea({ mode: "random", businessModel: selectedModel || undefined })}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <SpinnerIcon />
                Creando…
              </>
            ) : (
              <>
                <SparklesIcon />
                Generar idea
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Custom Mode ── */}
      {mode === "custom" && (
        <CustomForm
          loading={loading}
          onBack={() => setMode(null)}
          onSubmit={(data) => generateIdea(data)}
        />
      )}
    </div>
  );
}

/* ── Custom Form ── */

function CustomForm({
  loading,
  onBack,
  onSubmit,
}: {
  loading: boolean;
  onBack: () => void;
  onSubmit: (data: { mode: "custom"; rawIdea: string; sector: string; targetUser: string; hints: string; businessModel?: string }) => void;
}) {
  const [rawIdea, setRawIdea] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (rawIdea.trim().length < 10) {
      errs.rawIdea = "Mínimo 10 caracteres para que la IA pueda trabajar";
    }
    if (rawIdea.trim().length > 2000) {
      errs.rawIdea = "Máximo 2000 caracteres";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const [selectedModel, setSelectedModel] = useState<string>("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      mode: "custom",
      rawIdea: rawIdea.trim(),
      sector: "",
      targetUser: "",
      hints: "",
      businessModel: selectedModel || undefined,
    });
  }

  const charCount = rawIdea.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeftIcon />
        Elegir otro modo
      </button>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="mb-4 flex items-center gap-3">
          <Target className="size-6 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-white">
              Idea personalizada
            </h2>
            <p className="text-sm text-slate-400">
              Describe tu idea y la IA la estructurará
            </p>
          </div>
        </div>

        {/* Modelo de negocio selector */}
        <div className="mb-4">
          <p className="mb-3 text-xs font-medium text-slate-400">
            Modelo de negocio:
          </p>
          <BusinessModelSelector
            selected={selectedModel}
            onChange={setSelectedModel}
          />
        </div>

        {/* Raw Idea — large textarea */}
        <div>
          <label
            htmlFor="rawIdea"
            className="mb-1.5 block text-sm font-medium text-slate-300"
          >
            Cuéntame tu idea <span className="text-red-400">*</span>
          </label>
          <textarea
            id="rawIdea"
            placeholder="Cuéntame tu idea... (sector, público objetivo, problema que resuelve, enfoque, monetización...)"
            value={rawIdea}
            onChange={(e) => {
              setRawIdea(e.target.value);
              if (formErrors.rawIdea) setFormErrors({});
            }}
            rows={10}
            maxLength={2000}
            className="w-full rounded-lg border bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 border-slate-700 focus:border-amber-500/50 resize-y min-h-[160px]"
          />
          <div className="mt-1 flex items-center justify-between">
            {formErrors.rawIdea ? (
              <p className="text-xs text-red-400">{formErrors.rawIdea}</p>
            ) : (
              <span />
            )}
            <span
              className={`text-xs tabular-nums ${
                charCount > 1800
                  ? "text-amber-400"
                  : charCount > 1500
                    ? "text-slate-400"
                    : "text-slate-500"
              }`}
            >
              {charCount}/2000
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <SpinnerIcon />
              Creando…
            </>
          ) : (
            <>
              <SparklesIcon />
              Reformular con IA
            </>
          )}
        </button>
      </div>
    </form>
  );
}

/* ── Business Model Card Selector ── */

function BusinessModelSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      {/* "Cualquiera" card */}
      <button
        type="button"
        onClick={() => onChange("")}
        className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
          selected === ""
            ? "border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30"
            : "border-slate-700 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900/80"
        }`}
      >
        <div className="flex items-center gap-3">
          <Shuffle className="size-5 text-amber-400 shrink-0" />
          <div>
            <p className={`text-sm font-medium ${selected === "" ? "text-amber-400" : "text-slate-200"}`}>
              Cualquiera
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              La IA elegirá el modelo más adecuado según las tendencias
            </p>
          </div>
        </div>
      </button>

      {/* Model cards */}
      <div className="grid gap-2 sm:grid-cols-2">
        {BUSINESS_MODELS.map((m) => {
          const isActive = selected === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange(isActive ? "" : m.value)}
              className={`text-left rounded-xl border px-4 py-3 transition-all ${
                isActive
                  ? "border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30"
                  : "border-slate-700 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900/80"
              }`}
            >
              <div className="flex items-start gap-3">
                <BusinessModelIcon model={m.value} className="size-5 shrink-0 mt-0.5 text-slate-400" />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isActive ? "text-amber-400" : "text-slate-200"}`}>
                    {m.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                  <p className="text-xs text-slate-600 mt-0.5 italic">
                    Ej: {m.example}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Icons ── */

function ArrowLeftIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}


