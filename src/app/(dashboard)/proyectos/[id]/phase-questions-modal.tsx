"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, AlertCircle, Info } from "lucide-react";
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
 * PhaseQuestionsModal — wizard-style multi-step form.
 *
 * Question types supported:
 *  - "text": single-line free text. Rendered as a textarea (3 rows).
 *  - "textarea": longer free text. Rendered as a textarea (6 rows).
 *  - "choice": single-select radio buttons.
 *  - "multi": multi-select checkboxes. Selected values are joined
 *    with a comma (",") and sent as a single string to preserve the
 *    existing API contract: the backend receives
 *    `Record<string, string>` regardless of question type.
 *
 * Layout:
 *  - The outer container is a `flex flex-col` capped at `max-h-[90vh]`
 *    so the footer navigation is always visible on mobile.
 *  - The middle area is `flex-1 overflow-y-auto min-h-0` and contains
 *    the progress bar plus the active step card. Switching steps
 *    applies a 24px horizontal slide driven by Tailwind keyframes
 *    (`animate-wizard-next` / `animate-wizard-prev`).
 *  - The footer is `shrink-0` and contains the back / next buttons.
 *
 * Submit flow (v4):
 *  - User clicks "Generar informe" on the summary step.
 *  - `handleSubmit` POSTs to `/api/projects/execute-phase`. The endpoint
 *    already transitions the phase to `PROCESSING` in the DB before
 *    returning the `jobId`.
 *  - On success: the modal closes immediately and `router.refresh()` is
 *    called so the parent picks up the new `PROCESSING` status. The
 *    parent's existing 5s polling effect (see `project-phases-with-modal`)
 *    then keeps the UI in sync while the job runs.
 *  - On error (network, 4xx, 5xx): the modal stays open with the error
 *    message and the user can retry or close manually.
 *  - This component owns NO polling — the parent owns it.
 */

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  label: string;
  type: string;
  options?: QuestionOption[];
}

interface PhaseQuestionsModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  phaseId: string;
  phaseType: string;
  questions: Question[];
}

export function PhaseQuestionsModal({
  open,
  onClose,
  projectId,
  phaseId,
  phaseType,
  questions,
}: PhaseQuestionsModalProps) {
  const wizard = useWizard(questions as WizardQuestion[]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // ── Reset wizard when modal opens ──
  useEffect(() => {
    if (open) {
      wizard.reset(questions as WizardQuestion[]);
      setError(null);
      setSubmitting(false);
    }
    // We intentionally only depend on `open` so question shape changes
    // mid-session don't blow away the user's answers; the wizard
    // is volatile by design (no persistence).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Submit (triggered from the summary step) ──
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    const filledAnswers: Record<string, string> = {};
    for (const [k, v] of Object.entries(wizard.answers)) {
      if (v && v.trim()) filledAnswers[k] = v.trim();
    }

    if (Object.keys(filledAnswers).length === 0) {
      setError("Responde al menos una pregunta");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/projects/execute-phase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          phaseId,
          phaseType,
          mode: "report",
          answers: filledAnswers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al enviar respuestas");
        setSubmitting(false);
        return;
      }
      // Success: the endpoint has already set the phase to PROCESSING in
      // the DB. Close the modal immediately and let the parent pick up
      // the new status via router.refresh(). The parent owns polling.
      onClose();
      router.refresh();
    } catch {
      setError("Error de conexión");
      setSubmitting(false);
    }
  }, [wizard.answers, projectId, phaseId, phaseType, onClose, router]);

  // ── Focus management ──
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeQuestion = wizard.isSummary
    ? null
    : (questions[wizard.currentStep] as WizardQuestion | undefined) ?? null;

  useFocusOnStepChange({
    inputRef,
    containerRef,
    question: activeQuestion,
    stepIndex: wizard.currentStep,
  });

  // ── Keyboard navigation ──
  const modalRef = useRef<HTMLDivElement | null>(null);
  const isLoading = submitting;
  useKeyboardNavigation({
    containerRef: modalRef,
    isDisabled: isLoading,
    canGoNext: wizard.isValid || wizard.isSummary,
    canGoPrev: !wizard.isFirst,
    onNext: () => {
      if (wizard.isSummary) {
        handleSubmit();
      } else {
        wizard.goNext();
      }
    },
    onPrev: wizard.goPrev,
    onClose: () => {
      if (!isLoading) onClose();
    },
    activeType: activeQuestion?.type,
  });

  // ── Backdrop click closes (when not loading) ──
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  }

  if (!open) return null;

  const currentQ = wizard.isSummary
    ? null
    : questions[wizard.currentStep];
  const currentAnswer = currentQ ? wizard.answers[currentQ.id] || "" : "";
  const totalRealSteps = questions.length;
  // Display label for the progress bar: "Pregunta X de Y" while on a
  // question, and a different copy on the summary step.
  const progressLabel = wizard.isSummary
    ? "Revisa tus respuestas"
    : `Pregunta ${wizard.currentStep + 1} de ${totalRealSteps}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="phase-questions-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 shrink-0">
          <h3
            id="phase-questions-modal-title"
            className="text-base font-semibold text-white"
          >
            Cuéntanos más
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <WizardProgress
            currentStep={wizard.currentStep}
            totalSteps={wizard.totalSteps}
            label={progressLabel}
          />

          {error && (
            <div
              className="mt-4 flex items-center gap-1 text-xs text-red-400"
              role="alert"
            >
              <AlertCircle className="size-3" />
              {error}
            </div>
          )}

          <p className="mt-4 mb-3 text-xs text-slate-400 leading-relaxed">
            Responde estas preguntas para ayudar a la IA a generar un
            análisis más preciso y adaptado a tu situación real.
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
                questions={questions as WizardQuestion[]}
                answers={wizard.answers}
                onEdit={(idx) => wizard.goTo(idx)}
              />
            ) : currentQ ? (
              <QuestionStep
                question={currentQ as WizardQuestion}
                stepNumber={wizard.currentStep + 1}
                answer={currentAnswer}
                inputRef={inputRef}
                containerRef={containerRef}
                onChange={(value) =>
                  wizard.setAnswer(currentQ.id, value)
                }
              />
            ) : null}
          </div>
        </div>

        {/* Pinned footer */}
        <div className="shrink-0 border-t border-slate-800 px-5 py-4">
          <WizardNavigation
            canGoBack={!wizard.isFirst}
            canGoForward={wizard.isSummary ? !isLoading : wizard.isValid}
            onBack={wizard.goPrev}
            onNext={() => {
              if (wizard.isSummary) {
                handleSubmit();
              } else {
                wizard.goNext();
              }
            }}
            isSummary={wizard.isSummary}
            isLastQuestion={wizard.isLastQuestion}
            isSubmitting={isLoading}
            submitLabel="Generar informe"
          />
        </div>
      </div>
    </div>
  );
}
