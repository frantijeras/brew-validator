"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";

/* ── Types ── */

type Mode = "random" | "custom" | null;

interface GeneratedIdea {
  title: string;
  description: string;
  targetUser: string;
  monetization: string;
  score: number;
  rationale: string;
}

type Status = "idle" | "generating" | "polling" | "done" | "error";

/* ── Spinner messages ── */

const SPINNER_MESSAGES = [
  "Buscando tendencias de mercado…",
  "Analizando datos del sector…",
  "Identificando oportunidades…",
  "Evaluando viabilidad…",
  "Generando ideas…",
  "Casi listo…",
];

/* ── Main Page ── */

export default function NewIdeaPage() {
  const [mode, setMode] = useState<Mode>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([]);
  const [error, setError] = useState("");
  const [ideaId, setIdeaId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Poll job status ──
  const pollJob = useCallback((jobId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { credentials: "same-origin" });
        if (!res.ok) return;

        const job = await res.json();

        if (job.status === "COMPLETED") {
          clearInterval(interval);
          pollingRef.current = null;

          // Parse output
          if (job.output) {
            const output =
              typeof job.output === "string"
                ? JSON.parse(job.output)
                : job.output;

            if (output.ideas && Array.isArray(output.ideas)) {
              setIdeas(output.ideas);
              setStatus("done");
            } else {
              setError("El agente no devolvió ideas válidas");
              setStatus("error");
            }
          } else {
            setError("El agente no devolvió resultados");
            setStatus("error");
          }
        } else if (job.status === "FAILED") {
          clearInterval(interval);
          pollingRef.current = null;
          setError(job.error || "El agente falló al generar las ideas");
          setStatus("error");
        }
      } catch {
        // network error, will retry
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        pollingRef.current = null;
        setError("Tiempo de espera agotado. Intenta de nuevo.");
        setStatus("error");
      }
    }, 2000);

    pollingRef.current = interval;
  }, []);

  // ── Random: start generation ──
  const generateRandom = useCallback(async () => {
    setStatus("generating");
    setError("");
    setIdeas([]);

    try {
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ mode: "random" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al generar la idea");
      }

      const { jobId, ideaId: newIdeaId } = await res.json();
      setIdeaId(newIdeaId);
      setStatus("polling");
      pollJob(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setStatus("error");
    }
  }, [pollJob]);

  // ── Custom: start generation ──
  const generateCustom = useCallback(
    async (data: { sector: string; targetUser: string; hints: string }) => {
      setStatus("generating");
      setError("");
      setIdeas([]);

      try {
        const res = await fetch("/api/ideas/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ mode: "custom", ...data }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al generar las ideas");
        }

        const { jobId, ideaId: newIdeaId } = await res.json();
        setIdeaId(newIdeaId);
        setStatus("polling");
        pollJob(jobId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
        setStatus("error");
      }
    },
    [pollJob]
  );

  // ── Use idea: update the placeholder with the generated data ──
  const useIdea = useCallback(
    async (idea: GeneratedIdea) => {
      if (!ideaId) return;
      setStatus("generating");

      try {
        const res = await fetch(`/api/ideas/${ideaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            title: idea.title,
            description: idea.description,
            targetUser: idea.targetUser,
            monetization: idea.monetization,
          }),
        });

        if (!res.ok) {
          throw new Error("Error al guardar la idea");
        }

        // Navigate to detail
        window.location.href = `/ideas/${ideaId}`;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
        setStatus("error");
      }
    },
    [ideaId]
  );

  // ── Reset ──
  const reset = useCallback(() => {
    setMode(null);
    setStatus("idle");
    setIdeas([]);
    setError("");
    setIdeaId(null);
  }, []);

  // ── Render ──
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
        <h1 className="text-3xl font-bold tracking-tight text-white">Nueva idea con IA</h1>
        <p className="mt-1 text-sm text-slate-400">
          Deja que la IA investigue tendencias y genere ideas de negocio por ti.
        </p>
      </div>

      {/* ── Step 1: Choose mode ── */}
      {mode === null && <ModeSelector onSelect={setMode} />}

      {/* ── Random Mode ── */}
      {mode === "random" && (
        <RandomGenerator
          status={status}
          ideas={ideas}
          error={error}
          onGenerate={generateRandom}
          onUseIdea={useIdea}
          onBack={reset}
        />
      )}

      {/* ── Custom Mode ── */}
      {mode === "custom" && (
        <CustomGenerator
          status={status}
          ideas={ideas}
          error={error}
          onGenerate={generateCustom}
          onUseIdea={useIdea}
          onBack={reset}
        />
      )}
    </div>
  );
}

/* ── Mode Selector ── */

function ModeSelector({ onSelect }: { onSelect: (mode: Mode) => void }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <button
        onClick={() => onSelect("random")}
        className="group rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-left transition-all hover:border-amber-500/40 hover:bg-slate-900/90"
      >
        <div className="mb-3 text-3xl">🎲</div>
        <h3 className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors">
          Idea aleatoria
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          La IA busca tendencias actuales de mercado y genera <strong className="text-slate-300">1 idea</strong> de negocio viable basada en datos reales.
        </p>
      </button>

      <button
        onClick={() => onSelect("custom")}
        className="group rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-left transition-all hover:border-amber-500/40 hover:bg-slate-900/90"
      >
        <div className="mb-3 text-3xl">🎯</div>
        <h3 className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors">
          Idea personalizada
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Tú defines el sector, el público objetivo y las pistas. La IA genera <strong className="text-slate-300">3 ideas</strong> distintas y viables.
        </p>
      </button>
    </div>
  );
}

/* ── Random Generator ── */

interface RandomGeneratorProps {
  status: Status;
  ideas: GeneratedIdea[];
  error: string;
  onGenerate: () => void;
  onUseIdea: (idea: GeneratedIdea) => void;
  onBack: () => void;
}

function RandomGenerator({
  status,
  ideas,
  error,
  onGenerate,
  onUseIdea,
  onBack,
}: RandomGeneratorProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate spinner messages
  useEffect(() => {
    if (status !== "generating" && status !== "polling") return;
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % SPINNER_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [status]);

  const isWorking = status === "generating" || status === "polling";

  return (
    <div>
      {/* Back button */}
      {status === "idle" && (
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeftIcon />
          Elegir otro modo
        </button>
      )}

      {/* Idle state */}
      {status === "idle" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <div className="mb-4 text-5xl">🎲</div>
          <h2 className="text-xl font-semibold text-white">Idea aleatoria</h2>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            La IA investigará tendencias de mercado actuales y generará una idea de
            negocio con datos reales.
          </p>
          <button
            onClick={onGenerate}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
          >
            <SparklesIcon />
            Generar idea
          </button>
        </div>
      )}

      {/* Working state */}
      {isWorking && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-12 text-center">
          <div className="mx-auto mb-6 size-16 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500" />
          <h3 className="text-lg font-medium text-white">Generando idea…</h3>
          <p className="mt-2 text-sm text-slate-400 transition-all duration-500">
            {SPINNER_MESSAGES[messageIndex]}
          </p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <ErrorBox message={error} onRetry={onGenerate} onBack={onBack} />
      )}

      {/* Done state */}
      {status === "done" && ideas.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Idea generada</h2>
            <div className="flex gap-3">
              <button
                onClick={onGenerate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800"
              >
                <RefreshIcon />
                Generar otra
              </button>
              <button
                onClick={onBack}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Modos
              </button>
            </div>
          </div>
          <IdeaCardLarge idea={ideas[0]} onUse={() => onUseIdea(ideas[0])} />
        </div>
      )}
    </div>
  );
}

/* ── Custom Generator ── */

interface CustomGeneratorProps {
  status: Status;
  ideas: GeneratedIdea[];
  error: string;
  onGenerate: (data: { sector: string; targetUser: string; hints: string }) => void;
  onUseIdea: (idea: GeneratedIdea) => void;
  onBack: () => void;
}

function CustomGenerator({
  status,
  ideas,
  error,
  onGenerate,
  onUseIdea,
  onBack,
}: CustomGeneratorProps) {
  const [sector, setSector] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [hints, setHints] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate spinner messages
  useEffect(() => {
    if (status !== "generating" && status !== "polling") return;
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % SPINNER_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [status]);

  const isWorking = status === "generating" || status === "polling";

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (sector.trim().length < 3) {
      errs.sector = "Mínimo 3 caracteres";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onGenerate({
      sector: sector.trim(),
      targetUser: targetUser.trim(),
      hints: hints.trim(),
    });
  }

  function handleRegenerate() {
    onGenerate({
      sector: sector.trim(),
      targetUser: targetUser.trim(),
      hints: hints.trim(),
    });
  }

  const showForm = status === "idle" || status === "error";

  return (
    <div>
      {/* Back button */}
      {status === "idle" && (
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeftIcon />
          Elegir otro modo
        </button>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Idea personalizada
                </h2>
                <p className="text-sm text-slate-400">
                  Define los parámetros y la IA generará 3 ideas para ti
                </p>
              </div>
            </div>

            {/* Sector */}
            <div className="mb-4">
              <label
                htmlFor="sector"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Sector <span className="text-red-400">*</span>
              </label>
              <input
                id="sector"
                type="text"
                placeholder="Ej: turismo rural en Asturias"
                value={sector}
                onChange={(e) => {
                  setSector(e.target.value);
                  if (formErrors.sector) setFormErrors({});
                }}
                maxLength={200}
                className="w-full rounded-lg border bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 border-slate-700 focus:border-amber-500/50"
              />
              {formErrors.sector && (
                <p className="mt-1 text-xs text-red-400">{formErrors.sector}</p>
              )}
            </div>

            {/* Target user */}
            <div className="mb-4">
              <label
                htmlFor="targetUser"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Público objetivo{" "}
                <span className="text-slate-500">(opcional)</span>
              </label>
              <input
                id="targetUser"
                type="text"
                placeholder="Ej: familias con niños pequeños"
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                maxLength={200}
                className="w-full rounded-lg border bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 border-slate-700 focus:border-amber-500/50"
              />
            </div>

            {/* Hints */}
            <div className="mb-4">
              <label
                htmlFor="hints"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Pistas / enfoque{" "}
                <span className="text-slate-500">(opcional)</span>
              </label>
              <input
                id="hints"
                type="text"
                placeholder="Ej: sostenibilidad, apps móviles, suscripción"
                value={hints}
                onChange={(e) => setHints(e.target.value)}
                maxLength={300}
                className="w-full rounded-lg border bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 border-slate-700 focus:border-amber-500/50"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
            >
              <SparklesIcon />
              Generar 3 ideas
            </button>
          </div>
        </form>
      )}

      {/* Working state */}
      {isWorking && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-12 text-center">
          <div className="mx-auto mb-6 size-16 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500" />
          <h3 className="text-lg font-medium text-white">
            Generando ideas para &ldquo;{sector}&rdquo;…
          </h3>
          <p className="mt-2 text-sm text-slate-400 transition-all duration-500">
            {SPINNER_MESSAGES[messageIndex]}
          </p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <ErrorBox
          message={error}
          onRetry={handleRegenerate}
          onBack={onBack}
        />
      )}

      {/* Done state */}
      {status === "done" && ideas.length > 0 && (
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">
              3 ideas para &ldquo;{sector}&rdquo;
            </h2>
            <div className="flex gap-3">
              <button
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800"
              >
                <RefreshIcon />
                Regenerar
              </button>
              <button
                onClick={onBack}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Modos
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {ideas.map((idea, i) => (
              <IdeaCardLarge key={i} idea={idea} onUse={() => onUseIdea(idea)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Idea Card (large, detailed) ── */

function IdeaCardLarge({
  idea,
  onUse,
}: {
  idea: GeneratedIdea;
  onUse: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 transition-all hover:border-slate-700">
      {/* Title + Score */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-white">{idea.title}</h3>
        <span className="shrink-0 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-400 tabular-nums">
          {idea.score}/10
        </span>
      </div>

      {/* Description */}
      <p className="mb-4 text-sm leading-relaxed text-slate-300">
        {idea.description}
      </p>

      {/* Details */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Público objetivo
          </span>
          <p className="mt-1 text-sm text-slate-300">{idea.targetUser}</p>
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Monetización
          </span>
          <p className="mt-1 text-sm text-slate-300">{idea.monetization}</p>
        </div>
      </div>

      {/* Rationale */}
      <div className="mb-5 rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
          Por qué funciona
        </span>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          {idea.rationale}
        </p>
      </div>

      {/* Action */}
      <button
        onClick={onUse}
        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
      >
        Usar esta idea
      </button>
    </div>
  );
}

/* ── Error Box ── */

function ErrorBox({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
      <div className="mb-3 text-3xl">⚠️</div>
      <h3 className="text-lg font-medium text-red-400">Error</h3>
      <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">{message}</p>
      <div className="mt-5 flex items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800"
          >
            <RefreshIcon />
            Reintentar
          </button>
        )}
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Volver a modos
          </button>
        )}
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

function RefreshIcon() {
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
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
