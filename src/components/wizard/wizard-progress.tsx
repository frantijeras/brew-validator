"use client";

import * as React from "react";

interface WizardProgressProps {
  /**
   * Current step index (0-based). Steps with index <= currentStep
   * are rendered as completed (amber).
   */
  currentStep: number;
  /**
   * Total number of steps to render as segments. Typically
   * `questions.length + 1` to account for the summary screen.
   */
  totalSteps: number;
  /**
   * Optional label shown below the bar. Defaults to a Spanish
   * counter matching the existing app copy.
   */
  label?: string;
}

/**
 * Segmented progress bar used by the question wizard.
 *
 * Renders `totalSteps` rounded segments (`h-1.5`) inside a `flex` row
 * with `gap-1`. Steps at or before `currentStep` are colored amber-500;
 * pending steps use the slate-700 background.
 *
 * The bar is intentionally purely presentational: no animation, no
 * scroll, no focus management. Direction of travel is communicated by
 * the parent wizard via slide transitions.
 */
export function WizardProgress({
  currentStep,
  totalSteps,
  label,
}: WizardProgressProps): React.ReactElement {
  const safeTotal = Math.max(1, totalSteps);
  const safeCurrent = Math.min(Math.max(0, currentStep), safeTotal - 1);

  const segments = Array.from({ length: safeTotal }, (_, idx) => idx <= safeCurrent);

  return (
    <div aria-hidden={false}>
      <div className="flex items-center gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={safeTotal} aria-valuenow={safeCurrent + 1}>
        {segments.map((filled, idx) => (
          <div
            key={idx}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              filled ? "bg-amber-500" : "bg-slate-700"
            }`}
          />
        ))}
      </div>
      {label !== "" && (
        <p className="mt-2 text-center text-xs text-slate-500">
          {label ?? `Pregunta ${safeCurrent + 1} de ${safeTotal}`}
        </p>
      )}
    </div>
  );
}
