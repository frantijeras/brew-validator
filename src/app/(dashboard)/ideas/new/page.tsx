"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dices, Target, PencilLine, AlertCircle } from "lucide-react";
import { BusinessModelDropdown } from "@/components/business-model-dropdown";
import { useBridgeStatus } from "@/hooks/use-bridge-status";

type Mode = "random" | "custom" | null;

export default function NewIdeaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const { status: bridgeStatus } = useBridgeStatus();
  const bridgeDown = bridgeStatus !== null && !bridgeStatus.reachable;

  async function generateIdea(body: object) {
    if (bridgeDown) {
      setError(
        "El servicio de IA no está disponible. El servidor local puede estar apagado. Inténtalo más tarde."
      );
      return;
    }
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

      await res.json();
      // Navega a la lista y FUERZA un refetch del servidor. Sin el refresh, el
      // Router Cache de Next sirve una lista vieja (sin la idea recién creada),
      // por lo que no hay ninguna idea en estado GENERATING y el auto-refresh
      // (useReactivePolling) no se activa: la tarjeta se queda congelada en
      // "Generando idea aleatoria…" hasta que el usuario recarga a mano.
      router.push("/ideas");
      router.refresh();
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
          <div className="flex items-center justify-center gap-2 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
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

      {/* ── Step 1: Choose mode (2 cards) ── */}
      {mode === null && !error && (
        <div>
          <h2 className="mb-2 text-base font-medium text-slate-300">
            ¿Cómo quieres generar tu idea?
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            Elige el modo de generación. Luego podrás ajustar el tipo de negocio.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("random")}
              className="group flex flex-col items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-left transition-all hover:border-amber-500/50 hover:bg-slate-900"
            >
              <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-400 group-hover:bg-amber-500/20">
                <Dices className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Idea aleatoria</h3>
                <p className="mt-1 text-sm text-slate-400">
                  La IA genera una idea a partir de tendencias de mercado actuales.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("custom")}
              className="group flex flex-col items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-left transition-all hover:border-amber-500/50 hover:bg-slate-900"
            >
              <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-400 group-hover:bg-amber-500/20">
                <PencilLine className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Idea personalizada</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Tú escribes la idea y la IA la estructura y mejora.
                </p>
              </div>
            </button>
          </div>
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
            <BusinessModelDropdown
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
    if (!selectedModel) {
      errs.businessModel = "Selecciona un modelo de negocio para que la IA tenga mejor contexto";
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
            Modelo de negocio <span className="text-red-400">*</span>
          </p>
          <BusinessModelDropdown
            selected={selectedModel}
            onChange={(v) => { setSelectedModel(v); if (formErrors.businessModel) setFormErrors({}); }}
            allowAny={false}
          />
          {formErrors.businessModel && (
            <p className="mt-1.5 text-xs text-red-400">{formErrors.businessModel}</p>
          )}
        </div>

        {/* Raw Idea — large textarea */}
        <div>
          <label
            htmlFor="rawIdea"
            className="mb-1.5 block text-sm font-medium text-slate-300"
          >
            Tu idea en bruto <span className="text-red-400">*</span>
          </label>
          <textarea
            id="rawIdea"
            placeholder="Describe tu idea en pocas líneas. La IA la reescribirá mejorándola con datos de mercado, propuesta de valor clara y modelo de monetización concreto."
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


