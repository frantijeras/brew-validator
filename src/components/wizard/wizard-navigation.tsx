"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WizardNavigationProps {
  /** Whether the back button should be enabled. */
  canGoBack: boolean;
  /** Whether the forward / submit button should be enabled. */
  canGoForward: boolean;
  /** Click handler for the back button. */
  onBack: () => void;
  /** Click handler for the forward / submit button. */
  onNext: () => void;
  /**
   * True when the wizard is on the summary step. Changes the next
   * button label and icon to reflect the "submit" action.
   */
  isSummary: boolean;
  /**
   * True when the wizard is on the last real question (the one that
   * advances to the summary step). Changes the next label to
   * "Revisar respuestas".
   */
  isLastQuestion: boolean;
  /** True while the wizard is in a loading state (disables all buttons). */
  isSubmitting: boolean;
  /**
   * Optional override for the back button label. Defaults to "Atrás".
   */
  backLabel?: string;
  /**
   * Optional override for the forward label on the *last question*
   * (not on the summary). Defaults to "Revisar respuestas".
   */
  reviewLabel?: string;
  /**
   * Optional override for the submit label shown on the summary
   * step. Defaults to "Enviar respuestas".
   */
  submitLabel?: string;
  /**
   * Optional override for the forward label shown on regular
   * questions. Defaults to "Siguiente".
   */
  nextLabel?: string;
}

/**
 * Footer navigation bar for the wizard. Renders an "Atrás" button on
 * the left and a primary action on the right. The primary action
 * changes label/icon depending on whether the user is on a regular
 * question, the last question, or the summary step.
 *
 * The footer is meant to live outside the scrollable area so it stays
 * pinned to the bottom of the modal.
 */
export function WizardNavigation({
  canGoBack,
  canGoForward,
  onBack,
  onNext,
  isSummary,
  isLastQuestion,
  isSubmitting,
  backLabel = "Atrás",
  reviewLabel = "Revisar respuestas",
  submitLabel = "Enviar respuestas",
  nextLabel = "Siguiente",
}: WizardNavigationProps): React.ReactElement {
  let primaryLabel: string;
  let PrimaryIcon: React.ComponentType<{ className?: string }> = ArrowRight;
  if (isSummary) {
    primaryLabel = submitLabel;
    PrimaryIcon = Check;
  } else if (isLastQuestion) {
    primaryLabel = reviewLabel;
  } else {
    primaryLabel = nextLabel;
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {canGoBack ? (
        <Button variant="secondary" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft className="size-4" />
          {backLabel}
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}

      <Button
        variant="primary"
        onClick={onNext}
        disabled={!canGoForward || isSubmitting}
      >
        {isSubmitting && isSummary ? "Enviando…" : primaryLabel}
        {!isSubmitting && <PrimaryIcon className="size-4" />}
      </Button>
    </div>
  );
}
