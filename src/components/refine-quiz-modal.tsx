"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  ArrowRight,
  Check,
  RotateCcw,
  Lightbulb,
  Users,
  Search,
  Target,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Bot,
} from "lucide-react";

interface QuizAnswer {
  question: string;
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

interface QuizQuestion {
  question: string;
  questionType: "yesno" | "text";
  questionNumber: number;
  totalQuestions: number;
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

type Screen = "choice" | "manual" | "quiz" | "result" | "applied";

const QUESTION_ICONS = [Users, Search, Target, TrendingUp, Lightbulb, AlertTriangle];

export default function RefineQuizModal({
  open,
  idea,
  onClose,
  onApplied,
}: RefineQuizModalProps) {
  const [screen, setScreen] = useState<Screen>("choice");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [quizQuestion, setQuizQuestion] = useState<QuizQuestion | null>(null);
  const [refineResult, setRefineResult] = useState<RefineResult | null>(null);
  const [applying, setApplying] = useState(false);

  // Manual mode state
  const [manualText, setManualText] = useState("");

  // Current answer state for the active question
  const [ynAnswer, setYnAnswer] = useState<"yes" | "no" | null>(null);
  const [customAnswer, setCustomAnswer] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setScreen("choice");
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setLoading(false);
      setError("");
      setPollingJobId(null);
      setQuizQuestion(null);
      setRefineResult(null);
      setApplying(false);
      setManualText("");
      setYnAnswer(null);
      setCustomAnswer("");
      setTextAnswer("");
      setShowCustom(false);
    }
  }, [open]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const resetQuestionState = useCallback(() => {
    setYnAnswer(null);
    setCustomAnswer("");
    setTextAnswer("");
    setShowCustom(false);
    setError("");
  }, []);

  // ── Quiz flow ──

  async function startQuiz() {
    setScreen("quiz");
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/ideas/${idea.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          mode: "quiz",
          currentQuestion: 0,
          answers: [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al iniciar el quiz");
      }

      const data = await res.json();
      setPollingJobId(data.jobId);
      startPolling(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      setLoading(false);
    }
  }

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/ideas/${idea.id}/refine?jobId=${jobId}`,
          { credentials: "same-origin" }
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "RUNNING" && data.question) {
          if (pollRef.current) clearInterval(pollRef.current);
          setQuizQuestion({
            question: data.question,
            questionType: data.questionType || "text",
            questionNumber: data.questionNumber || 1,
            totalQuestions: data.totalQuestions || 6,
          });
          setLoading(false);
        }

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
          setLoading(false);
        }

        if (data.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(data.message || "Error en el refinamiento");
          setLoading(false);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
  }

  async function handleNextQuestion() {
    const qType = quizQuestion?.questionType || "text";
    const qText = quizQuestion?.question || "";

    let answerText: string;
    if (qType === "yesno") {
      if (showCustom && customAnswer.trim()) {
        answerText = `${ynAnswer === "yes" ? "Sí" : "No"} — ${customAnswer.trim()}`;
      } else if (ynAnswer) {
        answerText = ynAnswer === "yes" ? "Sí" : "No";
      } else {
        setError("Selecciona Sí o No antes de continuar");
        return;
      }
    } else {
      if (!textAnswer.trim()) {
        setError("Escribe una respuesta antes de continuar");
        return;
      }
      answerText = textAnswer.trim();
    }

    const newAnswers = [...answers, { question: qText, answer: answerText }];
    setAnswers(newAnswers);
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= 6) {
      // All questions answered — submit for final result
      setCurrentQuestionIndex(nextIndex);
      resetQuestionState();
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/ideas/${idea.id}/refine`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            mode: "quiz",
            currentQuestion: 6,
            answers: newAnswers,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al procesar el refinamiento");
        }

        const data = await res.json();
        setPollingJobId(data.jobId);
        startPolling(data.jobId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
        setLoading(false);
      }
    } else {
      // Submit next question
      setCurrentQuestionIndex(nextIndex);
      resetQuestionState();
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/ideas/${idea.id}/refine`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            mode: "quiz",
            currentQuestion: nextIndex,
            answers: newAnswers,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al procesar la pregunta");
        }

        const data = await res.json();
        setPollingJobId(data.jobId);
        startPolling(data.jobId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
        setLoading(false);
      }
    }
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
        body: JSON.stringify({
          mode: "manual",
          rawText: manualText.trim(),
        }),
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

  // ── Quiz result apply ──

  function handleRestart() {
    setScreen("choice");
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setLoading(false);
    setError("");
    setPollingJobId(null);
    setQuizQuestion(null);
    setRefineResult(null);
    setApplying(false);
    setManualText("");
    resetQuestionState();
  }

  async function handleApplyResult() {
    if (!refineResult) return;
    setApplying(true);
    setError("");

    try {
      // Update the idea
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

  if (!open) return null;

  const isLastQuestion = currentQuestionIndex === 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">
              {screen === "manual" ? "Escribir refinamiento" : "Refinar idea"}
            </h2>
          </div>
          <button
            onClick={onClose}
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
                Elige cómo quieres refinar tu idea:
              </p>

              {/* Current idea data */}
              <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-4 mb-6">
                <p className="text-sm font-medium text-white">{idea.title}</p>
                <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                  {idea.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {idea.targetUser && (
                    <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-slate-400">
                      {idea.targetUser}
                    </span>
                  )}
                  <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-slate-400">
                    {idea.monetization}
                  </span>
                </div>
                {idea.problem && (
                  <p className="mt-3 text-xs text-slate-500">
                    <span className="font-medium">Problema:</span> {idea.problem}
                  </p>
                )}
              </div>

              {/* Two action buttons */}
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
                      ✏️ Escribir mi refinamiento
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
                      🤖 Responder preguntas
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

          {/* ── Quiz Screen ── */}
          {screen === "quiz" && (
            <div>
              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Pregunta {quizQuestion ? quizQuestion.questionNumber : currentQuestionIndex + 1} de {quizQuestion?.totalQuestions || 6}
                  </span>
                  <span className="text-xs font-medium text-amber-400">
                    {quizQuestion
                      ? Math.round(
                          (quizQuestion.questionNumber / quizQuestion.totalQuestions) * 100
                        )
                      : Math.round(((currentQuestionIndex + 1) / 6) * 100)}
                    %
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                    style={{
                      width: `${
                        quizQuestion
                          ? (quizQuestion.questionNumber / quizQuestion.totalQuestions) * 100
                          : ((currentQuestionIndex + 1) / 6) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {loading && !quizQuestion ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Spinner />
                  <p className="text-sm text-slate-400">Preparando pregunta...</p>
                </div>
              ) : quizQuestion ? (
                <div>
                  <div className="mb-6">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5 rounded-full bg-amber-500/10 p-2">
                        <MessageSquare className="size-5 text-amber-400" />
                      </div>
                      <p className="text-base text-slate-200 leading-relaxed">
                        {quizQuestion.question}
                      </p>
                    </div>
                  </div>

                  {/* Yes/No question type */}
                  {quizQuestion.questionType === "yesno" && (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setYnAnswer("yes");
                            setError("");
                          }}
                          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                            ynAnswer === "yes"
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                              : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700"
                          }`}
                        >
                          <ThumbsUp className="size-4" />
                          Sí
                        </button>
                        <button
                          onClick={() => {
                            setYnAnswer("no");
                            setError("");
                          }}
                          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                            ynAnswer === "no"
                              ? "border-red-500 bg-red-500/10 text-red-400"
                              : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700"
                          }`}
                        >
                          <ThumbsDown className="size-4" />
                          No
                        </button>
                      </div>

                      {!showCustom ? (
                        <button
                          onClick={() => setShowCustom(true)}
                          className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          Personalizar respuesta...
                        </button>
                      ) : (
                        <div>
                          <textarea
                            value={customAnswer}
                            onChange={(e) => setCustomAnswer(e.target.value)}
                            placeholder="Explica tu respuesta con más detalle..."
                            rows={3}
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/50 focus:outline-none resize-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text question type */}
                  {quizQuestion.questionType === "text" && (
                    <div>
                      <textarea
                        value={textAnswer}
                        onChange={(e) => {
                          setTextAnswer(e.target.value);
                          setError("");
                        }}
                        placeholder="Escribe tu respuesta..."
                        rows={4}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/50 focus:outline-none resize-none"
                      />
                    </div>
                  )}

                  {/* Next/Finish button */}
                  <div className="mt-6">
                    <button
                      onClick={handleNextQuestion}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
                    >
                      {isLastQuestion ? (
                        <>
                          Finalizar
                          <Check className="size-4" />
                        </>
                      ) : (
                        <>
                          Siguiente
                          <ChevronRight className="size-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
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

              {/* Before / After comparison cards */}
              <div className="space-y-4 mb-6">
                <ComparisonCard
                  label="Título"
                  before={idea.title}
                  after={refineResult.title}
                />
                <ComparisonCard
                  label="Descripción"
                  before={idea.description}
                  after={refineResult.description}
                  multiline
                />
                {refineResult.problem && (
                  <ComparisonCard
                    label="Problema"
                    before={idea.problem || "—"}
                    after={refineResult.problem}
                    multiline
                  />
                )}
                {refineResult.valueProposition && (
                  <ComparisonCard
                    label="Propuesta de valor"
                    before={idea.valueProposition || "—"}
                    after={refineResult.valueProposition}
                    multiline
                  />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>

              {/* Action buttons */}
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
                onClick={onClose}
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
          <p
            className={`mt-1 text-sm text-slate-400 ${multiline ? "" : "truncate"}`}
          >
            {before}
          </p>
        </div>
        <div className="p-3 bg-amber-500/[0.03]">
          <span className="text-[10px] font-medium text-amber-500/70 uppercase tracking-wider">
            Después
          </span>
          <p
            className={`mt-1 text-sm text-slate-200 ${multiline ? "" : "truncate"}`}
          >
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
