"use client";

import { useEffect, type RefObject } from "react";

interface UseKeyboardNavigationArgs {
  /** Ref of the container element that should receive keydown events. */
  containerRef: RefObject<HTMLElement | null>;
  /** Whether the wizard is currently in a loading/submitting state. */
  isDisabled: boolean;
  /** Whether the wizard can move to the next step. */
  canGoNext: boolean;
  /** Whether the wizard can move to the previous step. */
  canGoPrev: boolean;
  /** Move to the next step. */
  onNext: () => void;
  /** Move to the previous step. */
  onPrev: () => void;
  /** Close the wizard (Escape). */
  onClose: () => void;
  /**
   * The type of the active question. For `textarea` we do NOT advance
   * on Enter (Enter should insert a newline). For `text` we DO advance
   * on Enter, matching the design's intent.
   */
  activeType?: string;
}

/**
 * `useKeyboardNavigation` adds keyboard support to the wizard:
 *
 * - **Enter** advances to the next step (`onNext`) unless the active
 *   question is a `textarea` (Enter inserts a newline) or the wizard
 *   is disabled. `text` and `choice` questions DO advance on Enter.
 * - **ArrowRight** also advances, **ArrowLeft** goes back, mirroring
 *   the visual left/right flow of the slide animation.
 * - **Escape** closes the wizard via `onClose` (typically the modal
 *   close button).
 *
 * The listener is attached to the supplied container ref so it doesn't
 * interfere with inputs rendered in other parts of the page.
 */
export function useKeyboardNavigation({
  containerRef,
  isDisabled,
  canGoNext,
  canGoPrev,
  onNext,
  onPrev,
  onClose,
  activeType,
}: UseKeyboardNavigationArgs): void {
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isDisabled) return;

      // Escape closes the wizard regardless of focus target.
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      // Enter advances.
      if (event.key === "Enter" && !event.shiftKey) {
        const target = event.target as HTMLElement | null;
        const inTextarea = target?.tagName === "TEXTAREA";
        // Only block Enter for the long `textarea` type. Short `text`
        // (also rendered as <textarea> with rows=3) advances on Enter
        // per the design.
        if (inTextarea && activeType === "textarea") return;
        if (!canGoNext) return;
        event.preventDefault();
        onNext();
        return;
      }

      if (event.key === "ArrowRight") {
        if (!canGoNext) return;
        event.preventDefault();
        onNext();
        return;
      }

      if (event.key === "ArrowLeft") {
        if (!canGoPrev) return;
        event.preventDefault();
        onPrev();
        return;
      }
    }

    node.addEventListener("keydown", handleKeyDown);
    return () => {
      node.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef, isDisabled, canGoNext, canGoPrev, onNext, onPrev, onClose, activeType]);
}
