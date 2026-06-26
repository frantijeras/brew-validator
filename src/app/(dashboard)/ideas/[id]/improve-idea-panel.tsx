"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useWizard,
  useFocusOnStepChange,
  useKeyboardNavigation,
  WizardProgress,
  QuestionStep,
  SummaryStep,
  WizardNavigation,
  type WizardQuestion,
} from "@/components/wizard";

/**
 * ImproveIdeaPanel — panel INLINE para mejorar la idea según el veredicto de la
 * validación, mediante un breve cuestionario generado por IA.
 *
 * RESUMABLE / NAVIGATION-PROOF. Todo el flujo deja la idea en status IMPROVING
 * server-side (desde el POST /improve/questions), así que la página renderiza
 * este panel siempre que status === "IMPROVING". El panel, al montarse, consulta
 * GET /improve/state y restaura el sub-paso correcto:
 *  - "generating" → "Generando preguntas…" (sondea el job hasta el quiz).
 *  - "quiz"       → renderiza el cuestionario (preguntas recuperadas del job).
 *  - "applying"   → spinner "Mejorando idea…" (el apply ya está en curso).
 *  - "none"       → no hay flujo activo: avisa al padre (onApplied) para refrescar.
 *
 * Al enviar el quiz: POST /improve/apply {answers} → la idea pasa a IMPROVING
 * (applying) y luego a DRAFT (server). En generating/quiz hay un botón
 * "Cancelar mejora" que llama a POST /improve/cancel y refresca.
 *
 * Un 403 en /improve/apply dispara onLimit (el padre abre el DemoLimitDialog).
 */

type QuestionType = "text" | "choice";

interface ImproveQuestion {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
}

interface ImproveIdeaPanelProps {
  ideaId: string;
  /** El flujo terminó o no hay nada activo: el padre refresca la idea. */
  onApplied: () => void;
  /** Cancelado: el padre refresca (la idea ya salió de IMPROVING). */
  onCancelled: () => void;
  /** 403 en apply → el padre abre el diálogo de límite. */
  onLimit: () => void;
}

// Sub-pasos visibles del panel.
type Phase = "loading" | "generating" | "quiz" | "applying" | "error";

export function ImproveIdeaPanel({
  ideaId,
  onApplied,
  onCancelled,
  onLimit,
}: ImproveIdeaPanelProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<ImproveQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Evita doble arranque (StrictMode monta dos veces en desarrollo).
  const startedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Sondea el job de preguntas hasta que termine y pasa al quiz.
  const pollQuestionsJob = useCallback(
    (jobId: string) => {
      stopPolling();
      const tick = async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`, {
            credentials: "same-origin",
            cache: "no-store",
          });
          if (!res.ok) return; // reintenta en el siguiente tick
          const job = await res.json();
          if (job.status === "COMPLETED") {
            stopPolling();
            const parsed = parseQuestions(job.output);
            if (parsed.length === 0) {
              setPhase("error");
              setError(
                "La IA no devolvió preguntas. Cancela la mejora e inténtalo de nuevo."
              );
              return;
            }
            setQuestions(parsed);
            setPhase("quiz");
          } else if (job.status === "FAILED" || job.status === "CANCELLED") {
            stopPolling();
            setPhase("error");
            setError(
              job.error || "No se pudieron generar las preguntas. Cancela y reinténtalo."
            );
          }
        } catch {
          // Error transitorio de red: reintenta en el siguiente tick.
        }
      };
      void tick();
      pollRef.current = setInterval(tick, 2000);
    },
    [stopPolling]
  );

  // RESUME: al montar, consulta el estado del flujo y restaura el sub-paso.
  const loadState = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/improve/state`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("No se pudo recuperar el estado de la mejora");
      const data = await res.json();

      if (data.phase === "applying") {
        setPhase("applying");
        return;
      }
      if (data.phase === "generating") {
        setPhase("generating");
        if (data.jobId) pollQuestionsJob(data.jobId);
        return;
      }
      if (data.phase === "quiz") {
        const parsed = parseQuestions({ questions: data.questions });
        if (parsed.length === 0) {
          setPhase("error");
          setError(
            "La IA no devolvió preguntas. Cancela la mejora e inténtalo de nuevo."
          );
          return;
        }
        setQuestions(parsed);
        setPhase("quiz");
        return;
      }
      // phase === "none" (u otro): no hay flujo activo. El padre refresca para
      // salir de IMPROVING / mostrar el contenido normal.
      onApplied();
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Error al recuperar la mejora");
    }
  }, [ideaId, pollQuestionsJob, onApplied]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void loadState();
    return stopPolling;
  }, [loadState, stopPolling]);

  async function handleSubmit(answers: Record<string, string>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/improve/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ answers }),
      });
      if (res.status === 403) {
        onLimit();
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo aplicar la mejora");
      }
      // El servidor deja la idea en IMPROVING (applying); el padre refresca y la
      // página vuelve a renderizar el panel, que mostrará el spinner "Mejorando
      // idea…" hasta que el webhook devuelva la idea a DRAFT.
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aplicar la mejora");
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/improve/cancel`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo cancelar la mejora");
      }
      stopPolling();
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar la mejora");
      setCancelling(false);
    }
  }

  // ── Wizard ──
  // Mapeamos las preguntas de mejora al formato del wizard compartido:
  //  - "choice" con opciones → wizard "choice" (string[] → {value,label}[]).
  //  - cualquier otra (la pregunta abierta/personalizada final) → "textarea"
  //    para ofrecer un campo de texto libre.
  const wizardQuestions = useMemo<WizardQuestion[]>(
    () =>
      questions.map((q) =>
        q.type === "choice" && q.options && q.options.length > 0
          ? {
              id: q.id,
              label: q.label,
              type: "choice",
              options: q.options.map((o) => ({ value: o, label: o })),
            }
          : { id: q.id, label: q.label, type: "textarea" }
      ),
    [questions]
  );

  const wizard = useWizard(wizardQuestions);

  // Reinicia el wizard cuando se cargan/regeneran las preguntas.
  useEffect(() => {
    if (wizardQuestions.length > 0) {
      wizard.reset(wizardQuestions);
    }
    // Solo dependemos de las preguntas: no queremos reiniciar las respuestas
    // del usuario en cada render del wizard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardQuestions]);

  // Construye el Record<string,string> que espera la API a partir de las
  // respuestas del wizard. Para "multi" se unen con ", " (no se usa aquí, pero
  // mantiene el contrato consistente con el quiz de fases).
  const collectAnswers = useCallback((): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const q of wizardQuestions) {
      const value = (wizard.answers[q.id] ?? "").trim();
      if (value) result[q.id] = value;
    }
    return result;
  }, [wizardQuestions, wizard.answers]);

  // ── Focus + teclado (igual que el quiz de fases) ──
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const stepContainerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const activeQuestion = wizard.isSummary
    ? null
    : wizardQuestions[wizard.currentStep] ?? null;

  useFocusOnStepChange({
    inputRef,
    containerRef: stepContainerRef,
    question: activeQuestion,
    stepIndex: wizard.currentStep,
  });

  useKeyboardNavigation({
    containerRef: panelRef,
    isDisabled: phase !== "quiz" || submitting || cancelling,
    canGoNext: wizard.isValid || wizard.isSummary,
    canGoPrev: !wizard.isFirst,
    onNext: () => {
      if (wizard.isSummary) {
        void handleSubmit(collectAnswers());
      } else {
        wizard.goNext();
      }
    },
    onPrev: wizard.goPrev,
    onClose: () => {},
    activeType: activeQuestion?.type,
  });

  // El botón "Cancelar mejora" solo está disponible en generating/quiz/error
  // (NO en applying, donde la mejora ya está consumida y en curso).
  const canCancel = phase === "generating" || phase === "quiz" || phase === "error";

  const progressLabel = wizard.isSummary
    ? "Revisa tus respuestas"
    : `Pregunta ${wizard.currentStep + 1} de ${wizardQuestions.length}`;

  return (
    <div
      ref={panelRef}
      className="mb-8 rounded-xl border border-amber-500/30 bg-slate-900/50 p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-4 text-amber-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Mejorar idea según el veredicto
        </h2>
      </div>

      {(phase === "loading" || phase === "generating") && (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <span className="size-8 animate-spin rounded-full border-4 border-slate-700 border-t-amber-400" />
          <p className="text-sm font-medium text-slate-300">
            {phase === "loading" ? "Recuperando mejora…" : "Generando preguntas…"}
          </p>
          {canCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelando…" : "Cancelar mejora"}
            </Button>
          )}
        </div>
      )}

      {phase === "applying" && (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <span className="size-8 animate-spin rounded-full border-4 border-slate-700 border-t-amber-400" />
          <p className="text-sm font-medium text-slate-300">Mejorando idea…</p>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelando…" : "Cancelar mejora"}
            </Button>
          </div>
        </div>
      )}

      {phase === "quiz" && (
        <>
          <WizardProgress
            currentStep={wizard.currentStep}
            totalSteps={wizard.totalSteps}
            label={progressLabel}
          />

          <p className="mb-5 mt-4 text-sm text-slate-400">
            Responde estas preguntas para reescribir la idea con lo aprendido en
            la validación. Al aplicar, se reiniciará la validación para que puedas
            volver a validarla.
          </p>

          <div
            key={wizard.currentStep}
            className={
              wizard.direction === "next"
                ? "animate-wizard-next"
                : "animate-wizard-prev"
            }
          >
            {wizard.isSummary ? (
              <SummaryStep
                questions={wizardQuestions}
                answers={wizard.answers}
                onEdit={(idx) => wizard.goTo(idx)}
              />
            ) : activeQuestion ? (
              <QuestionStep
                question={activeQuestion}
                stepNumber={wizard.currentStep + 1}
                answer={wizard.answers[activeQuestion.id] || ""}
                inputRef={inputRef}
                containerRef={stepContainerRef}
                onChange={(value) => wizard.setAnswer(activeQuestion.id, value)}
              />
            ) : null}
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Navegación del wizard + acción de cancelar */}
          <div className="mt-6 space-y-3">
            <WizardNavigation
              canGoBack={!wizard.isFirst}
              canGoForward={wizard.isSummary ? !submitting : wizard.isValid}
              onBack={wizard.goPrev}
              onNext={() => {
                if (wizard.isSummary) {
                  void handleSubmit(collectAnswers());
                } else {
                  wizard.goNext();
                }
              }}
              isSummary={wizard.isSummary}
              isLastQuestion={wizard.isLastQuestion}
              isSubmitting={submitting}
              submitLabel={submitting ? "Aplicando…" : "Mejorar idea"}
            />
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={submitting || cancelling}
              >
                {cancelling ? "Cancelando…" : "Cancelar mejora"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Helpers ── */

/**
 * Extrae el array de preguntas del output del job (o de un objeto ya parseado).
 * El output puede llegar como objeto o como string JSON; las preguntas viven en
 * output.questions. Filtra y normaliza para tolerar formatos parcialmente válidos.
 */
function parseQuestions(output: unknown): ImproveQuestion[] {
  let obj: unknown = output;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return [];
    }
  }
  if (!obj || typeof obj !== "object") return [];
  const raw = (obj as Record<string, unknown>).questions;
  if (!Array.isArray(raw)) return [];

  const result: ImproveQuestion[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const q = item as Record<string, unknown>;
    const label = typeof q.label === "string" ? q.label.trim() : "";
    if (!label) return;
    const id =
      typeof q.id === "string" && q.id.trim().length > 0
        ? q.id.trim()
        : `q${index}`;
    const type: QuestionType = q.type === "choice" ? "choice" : "text";
    let options: string[] | undefined;
    if (type === "choice" && Array.isArray(q.options)) {
      options = q.options
        .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
        .map((o) => o.trim());
    }
    result.push({ id, label, type, options });
  });
  return result;
}
