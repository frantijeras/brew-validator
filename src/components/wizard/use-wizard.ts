"use client";

import { useCallback, useMemo, useState } from "react";

export type WizardDirection = "next" | "prev";

export interface WizardQuestionOption {
  value: string;
  label: string;
}

export interface WizardQuestion {
  id: string;
  label: string;
  type: string;
  options?: WizardQuestionOption[];
}

export interface UseWizardOptions {
  /**
   * Initial answers (e.g. restored from storage). Keys are question ids.
   */
  initialAnswers?: Record<string, string>;
}

export interface UseWizardReturn {
  /** 0-based index of the current step (includes the summary step at the end). */
  currentStep: number;
  /** Total number of wizard steps: questions.length + 1 (summary). */
  totalSteps: number;
  /** Map of question id → user-typed / selected value. */
  answers: Record<string, string>;
  /** Direction of the last navigation, used to drive slide animations. */
  direction: WizardDirection;
  /** True if the user is on the summary screen (last step). */
  isSummary: boolean;
  /** True if the user is on the very first question. */
  isFirst: boolean;
  /** True if the user is on the last real question (before the summary). */
  isLastQuestion: boolean;
  /** Whether the current step has a valid (non-empty) answer. */
  isValid: boolean;
  /** Set the answer for a question by id. */
  setAnswer: (questionId: string, value: string) => void;
  /** Move to the next step (no-op when invalid or on summary). */
  goNext: () => void;
  /** Move to the previous step (no-op on first question). */
  goPrev: () => void;
  /** Jump to a specific step (0-based). Clamps to valid range. */
  goTo: (step: number) => void;
  /** Reset all answers and return to the first step. */
  reset: (questions: WizardQuestion[]) => void;
}

/**
 * `useWizard` encapsulates the step-by-step state machine used by the
 * phase-questions modal (and any future wizard with the same shape).
 *
 * Conventions:
 * - `currentStep` is 0-based. Steps `[0, questions.length - 1]` are the
 *   real questions, and step `questions.length` is the summary screen.
 * - A question is valid when its answer is a non-empty trimmed string.
 *   For `multi` types the caller still stores a comma-separated string,
 *   so the same trim check works.
 * - Direction is updated by `goNext` / `goPrev` so the parent can apply
 *   the appropriate CSS transition class.
 */
export function useWizard(
  questions: WizardQuestion[],
  options: UseWizardOptions = {}
): UseWizardReturn {
  const { initialAnswers } = options;
  const totalSteps = questions.length + 1;

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<WizardDirection>("next");
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => initialAnswers ?? {}
  );

  const isSummary = currentStep >= questions.length;
  const isFirst = currentStep === 0;
  const isLastQuestion = currentStep === questions.length - 1;

  const currentQuestion = isSummary ? null : questions[currentStep];
  const isValid = useMemo(() => {
    if (isSummary) return true;
    if (!currentQuestion) return false;
    const value = answers[currentQuestion.id];
    return typeof value === "string" && value.trim().length > 0;
  }, [answers, currentQuestion, isSummary]);

  const setAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const goNext = useCallback(() => {
    if (isSummary) return;
    if (!isValid) return;
    setDirection("next");
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [isSummary, isValid, totalSteps]);

  const goPrev = useCallback(() => {
    if (currentStep === 0) return;
    setDirection("prev");
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, [currentStep]);

  const goTo = useCallback(
    (step: number) => {
      const clamped = Math.min(Math.max(0, step), totalSteps - 1);
      // Direction is inferred from the delta so animations stay accurate.
      setDirection((prev) => (clamped >= currentStep ? "next" : "prev"));
      setCurrentStep(clamped);
    },
    [currentStep, totalSteps]
  );

  const reset = useCallback((qs: WizardQuestion[]) => {
    const initial: Record<string, string> = {};
    qs.forEach((q) => {
      initial[q.id] = "";
    });
    setAnswers(initial);
    setCurrentStep(0);
    setDirection("next");
  }, []);

  return {
    currentStep,
    totalSteps,
    answers,
    direction,
    isSummary,
    isFirst,
    isLastQuestion,
    isValid,
    setAnswer,
    goNext,
    goPrev,
    goTo,
    reset,
  };
}
