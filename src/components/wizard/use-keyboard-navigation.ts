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
   * on Enter (Enter should insert a newline).
   */
  activeType?: string;
}

/**
 * `useKeyboardNavigation` adds keyboard support to the wizard:
 *
 * - **Enter** advances to the next step (`onNext`) unless the active
 *   question is a `textarea` (Enter inserts a newline) or the wizard
 *   is disabled.
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

      // Enter advances. Skip when the user is typing in a textarea
      // (Enter must insert a newline) or inside an actual <input>
      // of type text — we still want to advance, so we only block
      // for <textarea>.
      if (event.key === "Enter" && !event.shiftKey) {
        const target = event.target as HTMLElement | null;
        const inTextarea = target?.tagName === "TEXTAREA";
        if (inTextarea) return;
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
