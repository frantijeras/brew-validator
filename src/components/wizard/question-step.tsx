"use client";

import * as React from "react";
import type { RefObject } from "react";
import type { WizardQuestion, WizardQuestionOption } from "./use-wizard";

interface QuestionStepProps {
  /** The question to render. */
  question: WizardQuestion;
  /** 1-based step number shown in the circular badge. */
  stepNumber: number;
  /** Current answer for this question. Empty string when unanswered. */
  answer: string;
  /** Forwarded ref pointing to the input/textarea (text + textarea). */
  inputRef: RefObject<HTMLTextAreaElement | null>;
  /**
   * Forwarded ref pointing to the wrapping card element. Used for
   * focus management on `choice` / `multi` types and for
   * `aria-live` announcements.
   */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Called whenever the user updates the answer. */
  onChange: (value: string) => void;
}

/**
 * `QuestionStep` renders a single question card.
 *
 * Supported types:
 * - `text`     → 3-row textarea.
 * - `textarea` → 6-row textarea.
 * - `choice`   → radio-style option list.
 * - `multi`    → checkbox-style option list; values are joined with a
 *                comma to preserve the existing API contract.
 *
 * The card uses `rounded-xl border border-slate-800 bg-slate-800/40 p-5`
 * to match the `refine-idea-section` style. The container is
 * `aria-live="polite"` so screen readers announce the new question when
 * the wizard advances, and it carries `tabIndex={-1}` so it can be
 * focused programmatically.
 */
export function QuestionStep({
  question,
  stepNumber,
  answer,
  inputRef,
  containerRef,
  onChange,
}: QuestionStepProps): React.ReactElement {
  // Normalize options: some payloads (e.g. from skills) emit raw strings
  // instead of {value,label} objects. Coerce to keep the renderer
  // agnostic of the payload shape.
  const rawOpts: Array<string | WizardQuestionOption> =
    (question.options as Array<string | WizardQuestionOption> | undefined) || [];
  const opts: WizardQuestionOption[] = rawOpts.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );

  // Opcion "Otro" para que el usuario pueda escribir su propia respuesta
  const CUSTOM_VALUE = "_custom_";
  const isCustomSelected = answer?.startsWith(CUSTOM_VALUE);
  const customText = isCustomSelected ? answer.replace(CUSTOM_VALUE + ":", "") : "";

  function handleChoiceChange(value: string) {
    if (value === CUSTOM_VALUE) {
      onChange(CUSTOM_VALUE + ":" + customText);
    } else {
      onChange(value);
    }
  }

  function handleCustomTextChange(value: string) {
    if (value.trim()) {
      onChange(CUSTOM_VALUE + ":" + value);
    } else {
      onChange("");
    }
  }

  function handleMultiToggle(value: string) {
    const current = answer || "";
    let list = current ? current.split(",").filter(Boolean) : [];

    if (value === CUSTOM_VALUE) {
      const idx = list.findIndex((v) => v.startsWith(CUSTOM_VALUE));
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(CUSTOM_VALUE + ":");
      }
    } else {
      const idx = list.indexOf(value);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(value);
      }
    }
    onChange(list.join(","));
  }

  function handleMultiCustomTextChange(value: string) {
    const current = answer || "";
    let parts = current ? current.split(",").filter(Boolean) : [];
    const customIdx = parts.findIndex((v) => v.startsWith(CUSTOM_VALUE));
    if (customIdx >= 0) {
      if (value.trim()) {
        parts[customIdx] = CUSTOM_VALUE + ":" + value;
      } else {
        parts.splice(customIdx, 1);
      }
    } else if (value.trim()) {
      parts.push(CUSTOM_VALUE + ":" + value);
    }
    onChange(parts.join(","));
  }

  // Para choice: el "Otro" esta seleccionado cuando el valor empieza por _custom_
  const choiceCustomSelected = answer?.startsWith(CUSTOM_VALUE);
  // Para multi: el "Otro" esta seleccionado cuando algun valor empieza por _custom_
  const multiCustomSelected = (answer || "").split(",").some((v) => v.startsWith(CUSTOM_VALUE));
  const multiCustomText = (answer || "").split(",")
    .find((v) => v.startsWith(CUSTOM_VALUE))
    ?.replace(CUSTOM_VALUE + ":", "") || "";

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      aria-live="polite"
      className="rounded-xl border border-slate-800 bg-slate-800/40 p-5 outline-none focus:outline-none"
    >
      <div className="flex items-start gap-3 mb-4">
        <span
          aria-hidden="true"
          className="shrink-0 rounded-full bg-amber-500/15 text-amber-400 text-sm font-semibold w-7 h-7 flex items-center justify-center mt-0.5"
        >
          {stepNumber}
        </span>
        <p className="text-base text-slate-100 leading-relaxed pt-0.5">
          {question.label}
        </p>
      </div>

      {/* text → 3 rows */}
      {question.type === "text" && (
        <textarea
          ref={inputRef}
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe tu respuesta..."
          rows={3}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
        />
      )}

      {/* textarea → 6 rows */}
      {question.type === "textarea" && (
        <textarea
          ref={inputRef}
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe tu respuesta..."
          rows={6}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
        />
      )}

      {/* choice → radio buttons */}
      {question.type === "choice" && (
        <div className="space-y-2">
          {opts.map((opt) => {
            const selected = (answer || "") === opt.value;
            return (
              <label
                key={opt.value}
                className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  selected
                    ? "border-amber-500 bg-amber-500/10 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={opt.value}
                  checked={selected}
                  onChange={() => handleChoiceChange(opt.value)}
                  className="size-4 cursor-pointer accent-amber-500 relative z-10"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
          {/* Opcion "Otro" con campo de texto */}
          <label
            className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              choiceCustomSelected
                ? "border-amber-500 bg-amber-500/10 text-white"
                : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600"
            }`}
          >
            <input
              type="radio"
              name={question.id}
              value={CUSTOM_VALUE}
              checked={choiceCustomSelected}
              onChange={() => handleChoiceChange(CUSTOM_VALUE)}
              className="size-4 cursor-pointer accent-amber-500 relative z-10"
            />
            <span>Respuesta personalizada</span>
          </label>
          {choiceCustomSelected && (
            <textarea
              value={customText}
              onChange={(e) => handleCustomTextChange(e.target.value)}
              placeholder="Escribe tu respuesta..."
              rows={3}
              className="ml-8 w-[calc(100%-2rem)] rounded-lg border border-amber-500/40 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
            />
          )}
        </div>
      )}

      {/* multi → checkboxes */}
      {question.type === "multi" && (
        <div className="space-y-2">
          {opts.map((opt) => {
            const current = answer || "";
            const selected = current
              .split(",")
              .filter(Boolean)
              .includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  selected
                    ? "border-amber-500 bg-amber-500/10 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => handleMultiToggle(opt.value)}
                  className="size-4 cursor-pointer accent-amber-500 relative z-10"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
          {/* Opcion "Otro" con campo de texto */}
          <label
            className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              multiCustomSelected
                ? "border-amber-500 bg-amber-500/10 text-white"
                : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600"
            }`}
          >
            <input
              type="checkbox"
              checked={multiCustomSelected}
              onChange={() => handleMultiToggle(CUSTOM_VALUE)}
              className="size-4 cursor-pointer accent-amber-500 relative z-10"
            />
            <span>Respuesta personalizada</span>
          </label>
          {multiCustomSelected && (
            <textarea
              value={multiCustomText}
              onChange={(e) => handleMultiCustomTextChange(e.target.value)}
              placeholder="Escribe tu respuesta..."
              rows={3}
              className="ml-8 w-[calc(100%-2rem)] rounded-lg border border-amber-500/40 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
            />
          )}
        </div>
      )}
    </div>
  );
}
