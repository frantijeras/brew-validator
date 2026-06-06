"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import type { WizardQuestion, WizardQuestionOption } from "./use-wizard";

interface SummaryStepProps {
  /** All questions in their original order. */
  questions: WizardQuestion[];
  /** Map of question id → answer (same shape as `useWizard.answers`). */
  answers: Record<string, string>;
  /**
   * Called when the user clicks "Editar" on an item. Receives the
   * 0-based index of the question to navigate to.
   */
  onEdit: (questionIndex: number) => void;
}

/**
 * `SummaryStep` renders a compact review list before the user submits
 * their answers. Each item shows the question label, the chosen
 * answer (or custom text), and an "Editar" button that jumps back to
 * the corresponding step.
 *
 * Long answers are truncated to two lines via `line-clamp-2`. For
 * `multi` answers we keep the comma-joined format used by the API.
 */
export function SummaryStep({
  questions,
  answers,
  onEdit,
}: SummaryStepProps): React.ReactElement {
  function formatAnswer(question: WizardQuestion, value: string): string {
    if (!value) return "—";
    if (question.type === "multi") {
      // Translate values to labels for readability.
      const list = value.split(",").filter(Boolean);
      const labels = list.map((v) => {
        const opt = question.options?.find((o: string | WizardQuestionOption) => {
          if (typeof o === "string") return o === v;
          return o.value === v;
        });
        if (!opt) return v;
        return typeof opt === "string" ? opt : opt.label;
      });
      return labels.length > 0 ? labels.join(", ") : "—";
    }
    if (question.type === "choice") {
      const opt = question.options?.find((o: string | WizardQuestionOption) => {
        if (typeof o === "string") return o === value;
        return o.value === value;
      });
      if (!opt) return value;
      return typeof opt === "string" ? opt : opt.label;
    }
    return value;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle2 className="size-5 text-amber-400" aria-hidden="true" />
        <h4 className="text-base font-semibold text-white">
          Revisa tus respuestas
        </h4>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Puedes volver atrás y editar cualquier respuesta antes de enviar.
      </p>

      <ul
        className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-800/30 overflow-hidden"
        aria-label="Resumen de respuestas"
      >
        {questions.map((q, idx) => {
          const value = answers[q.id] || "";
          return (
            <li
              key={q.id}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="shrink-0 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-semibold w-5 h-5 flex items-center justify-center mt-0.5"
                  >
                    {idx + 1}
                  </span>
                  <p className="text-xs font-medium text-slate-400 truncate">
                    {q.label}
                  </p>
                </div>
                <p
                  className="mt-1 ml-7 text-sm text-slate-100 line-clamp-2 break-words"
                  title={formatAnswer(q, value)}
                >
                  {formatAnswer(q, value)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEdit(idx)}
                className="shrink-0 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                Editar
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
