"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Check,
  RotateCcw,
  Sparkles,
  Bot,
  Edit3,
} from "lucide-react";

// ── Types ──

interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
}

interface UserAnswer {
  questionId: string;
  questionText: string;
  answer: string;
}

interface RefineResult {
  title: string;
  description: string;
  problem: string;
  valueProposition: string;
  targetUser: string;
  monetization: string;
  summary: string;
}

interface IdeaInput {
  id: string;
  title: string;
  description: string;
  problem: string | null;
  valueProposition: string | null;
  targetUser: string;
  monetization: string;
}

interface RefineQuizModalProps {
  open: boolean;
  idea: IdeaInput;
  onClose: () => void;
  onApplied: () => void;
}

type Screen = "choice" | "manual" | "quiz-loading" | "quiz-questions" | "quiz-analyzing" | "result" | "applied";

const QUIZ_STORAGE_KEY = "brew-refine-quiz";

interface QuizStorageState {
  screen: Screen;
  ideaId: string;
  questions: QuizQuestion[];
  answers: Record<string, string>;
  customInputs: Record<string, string>;
  showCustom: Record<string, boolean>;
  pollingJobId: string | null;
  refineResult: RefineResult | null;
}

function loadQuizState(): QuizStorageState | null {
  try {
    const raw = sessionStorage.getItem(QUIZ_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QuizStorageState;
  } catch {
    return null;
  }
}

function saveQuizState(state: QuizStorageState): void {
  try {
    sessionStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function clearQuizState(): void {
  try {
    sessionStorage.removeItem(QUIZ_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// ── Component ──

export default function RefineQuizModal({
  open,
  idea,
  onClose,
  onApplied,
}: RefineQuizModalProps) {
  // Try to restore from sessionStorage on first render
  const [initialized, setInitialized] = useState(false);
  const [screen, setScreen] = useState<Screen>("choice");
  const [error, setError] = useState("");

  // Quiz state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [showCustom, setShowCustom] = useState<Record<string, boolean>>({});
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Result state
  const [refineResult, setRefineResult] = useState<RefineResult | null>(null);
  const [applying, setApplying] = useState(false);

  // Manual mode
  const [manualText, setManualText] = useState("");

  // ── Restore or reset state when modal opens ──
  useEffect(() => {
    if (!open) {
      setInitialized(false);
      return;
    }

    if (initialized) {
      // Already restored once while open, don't reset
      return;
    }

    const saved = loadQuizState();
    if (saved && saved.ideaId === idea.id && saved.screen !== "choice" && saved.screen !== "applied") {
      // Restore previous quiz state
      setScreen(saved.screen);
      setQuestions(saved.questions);
      setAnswers(saved.answers);
      setCustomInputs(saved.customInputs);
      setShowCustom(saved.showCustom);
      setPollingJobId(saved.pollingJobId);
      setRefineResult(saved.refineResult);
      setError("");

      // Resume polling if in-progress
      if (saved.pollingJobId) {
        if (saved.screen === "quiz-loading") {
          startQuestionsPolling(saved.pollingJobId);
        } else if (saved.screen === "quiz-analyzing") {
          startResultPolling(saved.pollingJobId);
        }
      }
    } else {
      // Fresh start
      setScreen("choice");
      setError("");
      setQuestions([]);
      setAnswers({});
      setCustomInputs({});
      setShowCustom({});
      setPollingJobId(null);
      setRefineResult(null);
      setApplying(false);
      setManualText("");
      clearQuizState();
    }

    setInitialized(true);
  }, [open, idea.id]);

  // Persist quiz state to sessionStorage
  useEffect(() => {
    if (!open || !initialized) return;
    if (screen === "choice" || screen === "applied") {
      clearQuizState();
      return;
    }
    saveQuizState({
      screen,
      ideaId: idea.id,
      questions,
      answers,
      customInputs,
      showCustom,
      pollingJobId,
      refineResult,
    });
  }, [screen, questions, answers, customInputs, showCustom, pollingJobId, refineResult, open, initialized, idea.id]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Phase 1: Start quiz (get all questions) ──
  async function startQuiz() {
    setScreen("quiz-loading");
    setError("");

    try {
      const res = await fetch(`/api/ideas/${idea.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ mode: "quiz" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al iniciar el quiz");
      }

      const data = await res.json();
      setPollingJobId(data.jobId);
      startQuestionsPolling(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setScreen("choice");
    }
  }

  function startQuestionsPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/ideas/${idea.id}/refine?jobId=${jobId}`,
          { credentials: "same-origin" }
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "QUESTIONS_READY" && data.questions?.length > 0) {
          if (pollRef.current) clearInterval(pollRef.current);
          // Initialize answers map
          const initialAnswers: Record<string, string> = {};
          const initialShowCustom: Record<string, boolean> = {};
          const initialCustomInputs: Record<string, string> = {};
          for (const q of data.questions) {
            initialAnswers[q.id] = "";
            initialShowCustom[q.id] = false;
            initialCustomInputs[q.id] = "";
          }
          setQuestions(data.questions);
          setAnswers(initialAnswers);
          setShowCustom(initialShowCustom);
          setCustomInputs(initialCustomInputs);
          setScreen("quiz-questions");
        }

        if (data.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(data.message || "Error generando preguntas");
          setScreen("choice");
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
  }

  // ── Handle selecting an option (or custom answer) ──
  function selectOption(questionId: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setError("");
  }

  function toggleCustom(questionId: string) {
    setShowCustom((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  function setCustomAnswer(questionId: string, value: string) {
    setCustomInputs((prev) => ({ ...prev, [questionId]: value }));
    if (value.trim()) {
      setAnswers((prev) => ({ ...prev, [questionId]: value.trim() }));
    }
  }

  // ── Phase 2: Submit answers → get refined result ──
  async function handleSubmitAnswers() {
    // Validate all questions answered
    const missing = questions.filter((q) => !answers[q.id]?.trim());
    if (missing.length > 0) {
      setError(`Responde todas las preguntas antes de continuar (${missing.length} pendientes)`);
      return;
    }

    setScreen("quiz-analyzing");
    setError("");

    const userAnswers: UserAnswer[] = questions.map((q) => ({
      questionId: q.id,
      questionText: q.questionText,
      answer: answers[q.id]?.trim() || "",
    }));

    try {
      const res = await fetch(`/api/ideas/${idea.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ mode: "quiz", answers: userAnswers }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar respuestas");
      }

      const data = await res.json();
      setPollingJobId(data.jobId);
      startResultPolling(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setScreen("quiz-questions");
    }
  }

  function startResultPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/ideas/${idea.id}/refine?jobId=${jobId}`,
          { credentials: "same-origin" }
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "DONE") {
          if (pollRef.current) clearInterval(pollRef.current);
          setRefineResult({
            title: data.title || "",
            description: data.description || "",
            problem: data.problem || "",
            valueProposition: data.valueProposition || "",
            targetUser: data.targetUser || "",
            monetization: data.monetization || "",
            summary: data.summary || data.message || "",
          });
          setScreen("result");
        }

        if (data.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(data.message || "Error en el refinamiento");
          setScreen("quiz-questions");
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
  }

  // ── Manual mode ──
  async function handleManualApply() {
    if (!manualText.trim()) return;
    setApplying(true);
    setError("");

    try {
      const res = await fetch(`/api/ideas/${idea.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ mode: "manual", rawText: manualText.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al aplicar cambios");
      }

      setScreen("applied");
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aplicar cambios");
    } finally {
      setApplying(false);
    }
  }

  // ── Apply refined result ──
  async function handleApplyResult() {
    if (!refineResult) return;
    setApplying(true);
    setError("");

    try {
      const patchRes = await fetch(`/api/ideas/${idea.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          mode: "manual",
          title: refineResult.title,
          description: refineResult.description,
          problem: refineResult.problem,
          valueProposition: refineResult.valueProposition,
          targetUser: refineResult.targetUser,
          monetization: refineResult.monetization,
        }),
      });

      if (!patchRes.ok) {
        const data = await patchRes.json();
        throw new Error(data.error || "Error al aplicar cambios");
      }

      setScreen("applied");
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aplicar cambios");
    } finally {
      setApplying(false);
    }
  }

  function handleRestart() {
    setScreen("choice");
    setQuestions([]);
    setAnswers({});
    setCustomInputs({});
    setShowCustom({});
    setPollingJobId(null);
    setRefineResult(null);
    setError("");
    setManualText("");
    clearQuizState();
  }

  function handleClose() {
    clearQuizState();
    onClose();
  }

  if (!open) return null;

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">
              {screen === "manual" ? "Redactar manualmente" : "Pulir idea"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* ── Choice Screen ── */}
          {screen === "choice" && (
            <div>
              <p className="text-sm text-slate-400 mb-4">
                Elige cómo quieres pulir tu idea:
              </p>

              <CompactIdeaCard
                title={idea.title}
                description={idea.description}
                targetUser={idea.targetUser}
                monetization={idea.monetization}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setScreen("manual")}
                  className="flex flex-col items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-left transition-all hover:border-slate-600 hover:bg-slate-800 active:bg-slate-900"
                >
                  <div className="rounded-full bg-amber-500/10 p-3">
                    <Edit3 className="size-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Redactar manualmente
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Edita directamente el texto de la idea como prefieras
                    </p>
                  </div>
                </button>

                <button
                  onClick={startQuiz}
                  className="flex flex-col items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-left transition-all hover:border-slate-600 hover:bg-slate-800 active:bg-slate-900"
                >
                  <div className="rounded-full bg-amber-500/10 p-3">
                    <Bot className="size-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Responder preguntas
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      La IA te guía con preguntas para mejorar la idea
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Manual Screen ── */}
          {screen === "manual" && (
            <div>
              <p className="text-sm text-slate-400 mb-4">
                Escribe cómo quieres refinar la idea. Se guardará una versión automáticamente.
              </p>

              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={`Describe los cambios que quieres hacer a "${idea.title}"...`}
                rows={8}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/50 focus:outline-none resize-none"
              />

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleManualApply}
                  disabled={applying || !manualText.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applying ? (
                    <>
                      <Spinner />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Aplicar
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setManualText("");
                    setScreen("choice");
                  }}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ── Quiz Loading Screen ── */}
          {screen === "quiz-loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Spinner />
              <p className="text-sm text-slate-400">
                Generando preguntas personalizadas...
              </p>
              <p className="text-xs text-slate-500">
                La IA está analizando tu idea y el mercado para crear preguntas relevantes
              </p>
            </div>
          )}

          {/* ── Quiz Questions Screen (all questions in scroll) ── */}
          {screen === "quiz-questions" && questions.length > 0 && (
            <div>
              <p className="text-sm text-slate-400 mb-2">
                Responde todas las preguntas y pulsa Finalizar. La IA analizará tus respuestas para mejorar la idea.
              </p>

              <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-1">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-slate-800 bg-slate-800/30 p-4"
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <span className="shrink-0 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold w-5 h-5 flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {q.questionText}
                      </p>
                    </div>

                    {/* Option buttons */}
                    <div className="space-y-2 mb-2">
                      {q.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          onClick={() => selectOption(q.id, opt)}
                          className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-all ${
                            answers[q.id] === opt
                              ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                              : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-300"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {/* Custom answer toggle */}
                    {!showCustom[q.id] ? (
                      <button
                        onClick={() => toggleCustom(q.id)}
                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        Otra respuesta...
                      </button>
                    ) : (
                      <div>
                        <textarea
                          value={customInputs[q.id]}
                          onChange={(e) => setCustomAnswer(q.id, e.target.value)}
                          placeholder="Escribe tu propia respuesta..."
                          rows={2}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/50 focus:outline-none resize-none"
                        />
                        <button
                          onClick={() => toggleCustom(q.id)}
                          className="mt-1 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                        >
                          Ocultar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Submit button */}
              <div className="mt-6">
                <button
                  onClick={handleSubmitAnswers}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
                >
                  Finalizar
                  <Check className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Analyzing Screen ── */}
          {screen === "quiz-analyzing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Spinner />
              <p className="text-sm text-slate-400">
                Analizando respuestas...
              </p>
              <p className="text-xs text-slate-500">
                La IA está refinando tu idea basándose en tus respuestas
              </p>
            </div>
          )}

          {/* ── Result Screen ── */}
          {screen === "result" && refineResult && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="size-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">
                  Idea refinada
                </h3>
              </div>

              <p className="text-sm text-slate-400 mb-6">{refineResult.summary}</p>

              {/* Before / After comparison */}
              <div className="space-y-4 mb-6">
                <ComparisonCard label="Título" before={idea.title} after={refineResult.title} />
                <ComparisonCard label="Descripción" before={idea.description} after={refineResult.description} multiline />
                {refineResult.problem && (
                  <ComparisonCard label="Problema" before={idea.problem || "—"} after={refineResult.problem} multiline />
                )}
                {refineResult.valueProposition && (
                  <ComparisonCard label="Propuesta de valor" before={idea.valueProposition || "—"} after={refineResult.valueProposition} multiline />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ComparisonCard label="Usuario objetivo" before={idea.targetUser} after={refineResult.targetUser} />
                  <ComparisonCard label="Monetización" before={idea.monetization} after={refineResult.monetization} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleApplyResult}
                  disabled={applying}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applying ? (
                    <>
                      <Spinner />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Aplicar cambios
                    </>
                  )}
                </button>
                <button
                  onClick={handleRestart}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 shadow transition-all hover:border-slate-600 hover:bg-slate-700"
                >
                  <RotateCcw className="size-4" />
                  Volver a empezar
                </button>
              </div>
            </div>
          )}

          {/* ── Applied Screen ── */}
          {screen === "applied" && (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="size-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Cambios aplicados
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                La idea ha sido actualizada con la versión refinada.
              </p>
              <button
                onClick={handleClose}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 shadow transition-all hover:border-slate-600 hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function CompactIdeaCard({
  title,
  description,
  targetUser,
  monetization,
}: {
  title: string;
  description: string;
  targetUser: string;
  monetization: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4 mb-6">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className={`mt-1 text-sm text-slate-400 ${expanded ? "" : "line-clamp-2"}`}>
        {expanded ? description : description}
      </p>
      {description.length > 120 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {expanded ? "Mostrar menos" : "Ver más..."}
        </button>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {targetUser && (
          <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-slate-400">
            {targetUser}
          </span>
        )}
        <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-slate-400">
          {monetization}
        </span>
      </div>
    </div>
  );
}

function ComparisonCard({
  label,
  before,
  after,
  multiline,
}: {
  label: string;
  before: string;
  after: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/30 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-slate-800">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
        <div className="p-3">
          <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
            Antes
          </span>
          <p className={`mt-1 text-sm text-slate-400 ${multiline ? "" : "truncate"}`}>
            {before}
          </p>
        </div>
        <div className="p-3 bg-amber-500/[0.03]">
          <span className="text-[10px] font-medium text-amber-500/70 uppercase tracking-wider">
            Después
          </span>
          <p className={`mt-1 text-sm text-slate-200 ${multiline ? "" : "truncate"}`}>
            {after}
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="size-5 animate-spin text-amber-400"
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
