"use client";

import { useEffect, type RefObject } from "react";
import type { WizardQuestion } from "./use-wizard";

interface UseFocusOnStepChangeArgs {
  /**
   * Ref attached to the input/textarea of the active question
   * (for `text` and `textarea` types).
   */
  inputRef: RefObject<HTMLElement | null>;
  /**
   * Ref attached to the question card container. Used to focus the
   * wrapper for `choice` and `multi` questions so screen readers
   * announce the new step without forcing keyboard focus on a radio.
   */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * Active question, or `null` when the wizard is on the summary step.
   */
  question: WizardQuestion | null;
  /**
   * Index of the active step. Used as the effect dependency.
   */
  stepIndex: number;
}

/**
 * Moves keyboard focus when the wizard advances to a new step.
 *
 * - For `text` / `textarea` we focus the input directly so the user can
 *   start typing immediately.
 * - For `choice` / `multi` we focus the *container* (with `tabIndex={-1}`)
 *   so screen readers re-announce the question label, but the user keeps
 *   the focus position they had — focusing a hidden radio would be a
 *   jarring jump.
 *
 * The effect also fires on the first render (initial mount) so the
 * first step is announced.
 */
export function useFocusOnStepChange({
  inputRef,
  containerRef,
  question,
  stepIndex,
}: UseFocusOnStepChangeArgs): void {
  useEffect(() => {
    if (!question) return;
    const type = question.type;
    if (type === "text" || type === "textarea") {
      // Defer to the next frame so the DOM element of the new step
      // is committed before we call focus().
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
    // For choice/multi, focus the container so SR users hear the new step.
    const id = requestAnimationFrame(() => {
      const node = containerRef.current;
      if (!node) return;
      node.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [stepIndex, question, inputRef, containerRef]);
}
