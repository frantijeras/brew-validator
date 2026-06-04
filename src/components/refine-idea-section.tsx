"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Check,
  Sparkles,
  Bot,
  Edit3,
  Zap,
  XCircle,
} from "lucide-react";

// ── Derived processing states ──
const PROCESSING_SCREENS: Screen[] = ["quiz-loading", "quiz-analyzing"];
function isProcessing(
  screen: Screen,
  isManualPolling: boolean,
  manualApplying: boolean,
  applying: boolean
): boolean {
  return (
    PROCESSING_SCREENS.includes(screen) ||
    isManualPolling ||
    manualApplying ||
    applying
  );
}

// ── Types ──

interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
}

interface RefineResult {
  title: string;
  description: string;
  problem: string;
  valueProposition: string;
  targetUser: string;
  monetization: string;
  summary: string;
  suggestedBusinessModel?: string;
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

interface RefineIdeaSectionProps {
  idea: IdeaInput;
  onApplied: () => void;
  onCollapse: () => void;
  onValidate: () => void;
}

type Screen = "choice" | "quiz-loading" | "quiz-questions" | "quiz-analyzing" | "result" | "applied";

function storageKey(ideaId: string): string {
  return `brew-refine-${ideaId}`;
}

interface RefineStorageState {
  screen: Screen;
  activeTab: "quiz" | "manual";
  questions: QuizQuestion[];
  answers: Record<string, string>;
  customInputs: Record<string, string>;
  showCustom: Record<string, boolean>;
  pollingJobId: string | null;
  refineResult: RefineResult | null;
  manualText: string;
}

function loadRefineState(ideaId: string): RefineStorageState | null {
  try {
    const raw = localStorage.getItem(storageKey(ideaId));
    if (!raw) return null;
    return JSON.parse(raw) as RefineStorageState;
  } catch {
    return null;
  }
}

function saveRefineState(ideaId: string, state: RefineStorageState): void {
  try {
    localStorage.setItem(storageKey(ideaId), JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function clearRefineState(ideaId: string): void {
  try {
    localStorage.removeItem(storageKey(ideaId));
  } catch {
    // Ignore
  }
}

// ── Component ──

export default function RefineIdeaSection({
  idea,
  onApplied,
  onCollapse,
  onValidate,
}: RefineIdeaSectionProps) {
  const clearQuizState = () => { setQuestions([]); setAnswers({}); };

  const [initialized, setInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<"quiz" | "manual">("quiz");
  const [screen, setScreen] = useState<Screen>("choice");
  const [error, setError] = useState("");

  // Quiz state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [showCustom, setShowCustom] = useState<Record<string, boolean>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Result state
  const [refineResult, setRefineResult] = useState<RefineResult | null>(null);
  const [applying, setApplying] = useState(false);

  // Manual mode
  const [manualText, setManualText] = useState("");
  const [isManualPolling, setIsManualPolling] = useState(false);
  const [manualApplying, setManualApplying] = useState(false);

  // ── Restore or reset state on mount ──
  useEffect(() => {
    if (initialized) return;

    const saved = loadRefineState(idea.id);
    if (
      saved &&
      saved.screen !== "choice" &&
      saved.screen !== "applied"
    ) {
      // Restore previous state
      setScreen(saved.screen);
      setActiveTab(saved.activeTab);
      setQuestions(saved.questions);
      setAnswers(saved.answers);
      setCustomInputs(saved.customInputs);
      setShowCustom(saved.showCustom);
      setPollingJobId(saved.pollingJobId);
      setRefineResult(saved.refineResult);
      setManualText(saved.manualText || "");
      setCurrentStep(0);
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
      setCurrentStep(0);
      setPollingJobId(null);
      setRefineResult(null);
      setApplying(false);
      setManualText("");
      setIsManualPolling(false);
      setActiveTab("quiz");
      clearRefineState(idea.id);
    }

    setInitialized(true);
  }, [idea.id]);

  // Persist state to localStorage
  useEffect(() => {
    if (!initialized) return;
    if (screen === "choice" || screen === "applied") {
      clearRefineState(idea.id);
      return;
    }
    saveRefineState(idea.id, {
      screen,
      activeTab,
      questions,
      answers,
      customInputs,
      showCustom,
      pollingJobId,
      refineResult,
      manualText,
    });
  }, [
    screen,
    activeTab,
    questions,
    answers,
    customInputs,
    showCustom,
    pollingJobId,
    refineResult,
    manualText,
    initialized,
    idea.id,
  ]);

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

  const startQuestionsPolling = useCallback(
    (jobId: string) => {
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
    },
    [idea.id]
  );

  // ── Handle selecting an option ──
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

  // ── Wizard navigation ──
  function handleNext() {
    const q = questions[currentStep];
    if (!q) return;
    if (!answers[q.id]?.trim()) {
      setError("Responde la pregunta antes de continuar");
      return;
    }
    setError("");
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handlePrev() {
    setError("");
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  // ── Phase 2: Submit answers → get refined result ──
  async function handleSubmitAnswers() {
    const missing = questions.filter((q) => !answers[q.id]?.trim());
    if (missing.length > 0) {
      setError(
        `Responde todas las preguntas antes de continuar (${missing.length} pendientes)`
      );
      return;
    }

    setScreen("quiz-analyzing");
    setError("");

    const userAnswers = questions.map((q) => ({
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

  const startResultPolling = useCallback(
    (jobId: string) => {
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
    },
    [idea.id]
  );

  // ── Manual mode: start refinement with raw text ──
  async function handleManualSubmit() {
    if (!manualText.trim()) return;
    setManualApplying(true);
    setError("");
    setIsManualPolling(false);

    try {
      const res = await fetch(`/api/ideas/${idea.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ mode: "manual", rawText: manualText.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al procesar");
      }

      const data = await res.json();

      // If we got a jobId, start polling for the result
      if (data.jobId) {
        setPollingJobId(data.jobId);
        setIsManualPolling(true);
        startManualResultPolling(data.jobId);
      } else if (data.success) {
        // Direct update (no agent job)
        setScreen("applied");
      }
    } catch (err) {
      setManualApplying(false);
      setError(err instanceof Error ? err.message : "Error al procesar");
    }
  }

  const startManualResultPolling = useCallback(
    (jobId: string) => {
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
            setIsManualPolling(false);
          }

          if (data.status === "FAILED") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError(data.message || "Error en el refinamiento");
            setIsManualPolling(false);
          }
        } catch {
          // Ignore polling errors
        }
      }, 2000);
    },
    [idea.id]
  );

  // ── Go back to refinement choice from applied ──
  function handleKeepRefining() {
    setScreen("choice");
    setQuestions([]);
    setAnswers({});
    setCustomInputs({});
    setShowCustom({});
    setCurrentStep(0);
    setPollingJobId(null);
    setRefineResult(null);
    setError("");
    setManualText("");
    setIsManualPolling(false);
    setManualApplying(false);
    clearRefineState(idea.id);
  }

  // ── Apply refined result ──
  async function handleApplyResult() {
    if (!refineResult) return;
    setApplying(true);
    setError("");

    try {
      const res = await fetch(`/api/ideas/${idea.id}/refine/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          title: refineResult.title,
          description: refineResult.description,
          problem: refineResult.problem || "",
          valueProposition: refineResult.valueProposition || "",
          targetUser: refineResult.targetUser,
          monetization: refineResult.monetization,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al aplicar cambios");
      }

      setScreen("applied");
      clearRefineState(idea.id);
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
    setCurrentStep(0);
    setPollingJobId(null);
    setRefineResult(null);
    setError("");
    setManualText("");
    setIsManualPolling(false);
    setManualApplying(false);
    clearRefineState(idea.id);
  }

  // Go back to editing mode (discard comparison, keep text and tab)
  function handleDiscard() {
    setScreen("choice");
    setQuestions([]);
    setAnswers({});
    setCustomInputs({});
    setShowCustom({});
    setCurrentStep(0);
    setPollingJobId(null);
    setRefineResult(null);
    setError("");
    setIsManualPolling(false);
    setManualApplying(false);
    // Keep manualText so user can re-run refinement with same input
    clearRefineState(idea.id);
  }

  // Discard the proposal entirely — clears the result AND localStorage,
  // returns to the start screen. The idea stays in POLISHING (DB) so the
  // user can start a fresh refinement round.
  function handleDiscardProposal() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPollingJobId(null);
    setRefineResult(null);
    setQuestions([]);
    setAnswers({});
    setCustomInputs({});
    setShowCustom({});
    setCurrentStep(0);
    setManualText("");
    setActiveTab("quiz");
    setError("");
    setIsManualPolling(false);
    setManualApplying(false);
    setScreen("choice");
    clearRefineState(idea.id);
  }

  // Close the refine section WITHOUT canceling polishing — POLISHING state persists
  function handleCollapse() {
    // Don't clear localStorage — state persists across sessions
    onCollapse();
  }

  // ── Render ──

  return (
    <div className="mb-8 rounded-xl border border-amber-500/20 bg-slate-900/70 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <Sparkles className="size-4 text-amber-400" />
          <h3 className="text-base font-semibold text-white">Pulir idea</h3>
        </div>
        <button
          onClick={handleCollapse}
          disabled={isProcessing(screen, isManualPolling, manualApplying, applying)}
          className="rounded-md p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Cerrar sección"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Tabs — only visible at the very start, before any action */}
      {screen === "choice" && !manualText && questions.length === 0 && (
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab("quiz")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "quiz"
                ? "text-amber-400 border-amber-400 bg-amber-500/5"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <Bot className="size-4" />
            Responder preguntas
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "manual"
                ? "text-amber-400 border-amber-400 bg-amber-500/5"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <Edit3 className="size-4" />
            Redactar manualmente
          </button>
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SCREEN: choice → tabs
            ═══════════════════════════════════════════ */}
        {screen === "choice" && (
          <div>
            {activeTab === "quiz" ? (
              <div>
                <p className="text-sm text-slate-400 mb-4">
                  La IA analizará tu idea y te hará preguntas para refinarla. Tus respuestas
                  ayudarán a generar una versión mejorada.
                </p>
                <button
                  onClick={startQuiz}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
                >
                  <Bot className="size-4" />
                  Generar preguntas con IA
                </button>
              </div>
            ) : isManualPolling || manualApplying ? (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Spinner />
                <p className="text-sm text-slate-400">Analizando tu idea...</p>
                <p className="text-xs text-slate-500 max-w-md text-center">
                  La IA está refinando todos los campos basándose en tu texto
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-400 mb-4">
                  Edita libremente el texto completo de tu idea. La IA usará tu redacción como guía
                  para refinar todos los campos.
                </p>

                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder={`Escribe la versión refinada de tu idea "${idea.title}"...\n\nIncluye descripción, problema, propuesta de valor, usuario objetivo y monetización.`}
                  rows={10}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/50 focus:outline-none resize-y"
                />

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleManualSubmit}
                    disabled={!manualText.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Bot className="size-4" />
                    Mejorar con IA
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SCREEN: quiz-loading
            ═══════════════════════════════════════════ */}
        {screen === "quiz-loading" && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <Spinner />
            <p className="text-sm text-slate-400">
              Generando preguntas personalizadas...
            </p>
            <p className="text-xs text-slate-500 max-w-md text-center">
              La IA está analizando tu idea y el mercado para crear preguntas relevantes
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SCREEN: quiz-questions (wizard)
            ═══════════════════════════════════════════ */}
        {screen === "quiz-questions" && questions.length > 0 && (
          <div>
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center gap-1 mb-2">
                {questions.map((_, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      idx <= currentStep
                        ? "bg-amber-500"
                        : "bg-slate-700"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500 text-center">
                Pregunta {currentStep + 1} de {questions.length}
              </p>
            </div>

            {/* Question card */}
            {(() => {
              const q = questions[currentStep];
              if (!q) return null;

              return (
                <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="shrink-0 rounded-full bg-amber-500/15 text-amber-400 text-sm font-semibold w-7 h-7 flex items-center justify-center mt-0.5">
                      {currentStep + 1}
                    </span>
                    <p className="text-base text-slate-100 leading-relaxed pt-0.5">
                      {q.questionText}
                    </p>
                  </div>

                  {/* Option buttons */}
                  <div className="space-y-2 mb-3">
                    {q.options.map((opt, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => {
                          selectOption(q.id, opt);
                          setError("");
                        }}
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
                        rows={3}
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
              );
            })()}

            {/* Navigation buttons */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {currentStep > 0 ? (
                  <button
                    onClick={handlePrev}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-700"
                  >
                    Anterior
                  </button>
                ) : (
                  <div />
                )}
                <button
                  onClick={() => {
                    setQuestions([]);
                    setAnswers({});
                    setCustomInputs({});
                    setShowCustom({});
                    setCurrentStep(0);
                    setError("");
                    setScreen("choice");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Descartar preguntas
                </button>
              </div>

              {currentStep < questions.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  onClick={handleSubmitAnswers}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
                >
                  Finalizar
                  <Check className="size-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SCREEN: quiz-analyzing / manual-polling
            ═══════════════════════════════════════════ */}
        {screen === "quiz-analyzing" && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <Spinner />
            <p className="text-sm text-slate-400">Analizando tu idea...</p>
            <p className="text-xs text-slate-500 max-w-md text-center">
              La IA está refinando tu idea basándose en tus respuestas
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SCREEN: result — Before/After comparison
            ═══════════════════════════════════════════ */}
        {screen === "result" && !refineResult && (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400 mb-4">
              La propuesta se ha perdido. Esto puede pasar si recargaste la página justo cuando terminaba.
            </p>
            <button
              onClick={handleDiscardProposal}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 shadow transition-all hover:border-slate-600 hover:bg-slate-700"
            >
              <XCircle className="size-4" />
              Volver a empezar
            </button>
          </div>
        )}

        {screen === "result" && refineResult && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="size-5 text-amber-400" />
              <h4 className="text-base font-semibold text-white">
                Comparativa antes / después
              </h4>
            </div>

            {refineResult.summary && (
              <p className="text-sm text-slate-400 mb-6">{refineResult.summary}</p>
            )}

            {/* Side-by-side comparison — full text, no title row */}
            <div className="space-y-4 mb-6">
              <ComparisonCard
                label="Descripción"
                before={idea.description}
                after={refineResult.description}
              />
              <ComparisonCard
                label="Problema que resuelve"
                before={idea.problem || "—"}
                after={refineResult.problem}
              />
              <ComparisonCard
                label="Propuesta de valor"
                before={idea.valueProposition || "—"}
                after={refineResult.valueProposition}
              />
              <ComparisonCard
                label="Usuario objetivo"
                before={idea.targetUser}
                after={refineResult.targetUser}
              />
              <ComparisonCard
                label="Monetización"
                before={idea.monetization}
                after={refineResult.monetization}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
                    Aceptar y aplicar
                  </>
                )}
              </button>
              <button
                onClick={handleDiscardProposal}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 shadow transition-all hover:border-slate-600 hover:bg-slate-700"
              >
                <XCircle className="size-4" />
                Descartar propuesta
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            SCREEN: applied
            ═══════════════════════════════════════════ */}
        {screen === "applied" && (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Check className="size-6 text-emerald-400" />
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">
              Cambios aplicados
            </h4>
            <p className="text-sm text-slate-400 mb-8">
              La idea ha vuelto a estado Borrador. Los informes anteriores se han eliminado.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  onValidate();
                  handleCollapse();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
              >
                <Zap className="size-4" />
                Validar esta idea
              </button>
              <button
                onClick={handleKeepRefining}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 shadow transition-all hover:border-slate-600 hover:bg-slate-700"
              >
                <Edit3 className="size-4" />
                Seguir refinando
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function ComparisonCard({
  label,
  before,
  after,
  isSuggestion,
}: {
  label: string;
  before: string;
  after: string;
  isSuggestion?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/30 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-slate-800">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
        {/* Before */}
        <div className="p-4">
          <span className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
            {isSuggestion ? "Actual" : "Antes"}
          </span>
          <p className="mt-1 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
            {before || "—"}
          </p>
        </div>
        {/* After */}
        <div className="p-4 bg-amber-500/[0.03]">
          <span className="text-[10px] font-medium text-amber-500/70 uppercase tracking-wider">
            {isSuggestion ? "Sugerido" : "Después"}
          </span>
          <p className="mt-1 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
            {after || "—"}
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
