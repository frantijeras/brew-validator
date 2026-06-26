"use client";

import { useEffect, useRef, useState } from "react";

interface ClampTextProps {
  text: string | null | undefined;
  /** Number of lines to clamp to when collapsed. */
  lines: 2 | 3;
  className?: string;
}

const CLAMP_CLASS: Record<2 | 3, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
};

/**
 * Renders text clamped to a number of lines using CSS line-clamp.
 * Shows a "Ver más" / "Ver menos" toggle only when the content actually
 * overflows the clamped height.
 */
export function ClampText({
  text,
  lines,
  className = "text-sm text-slate-300 leading-relaxed",
}: ClampTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      // Only meaningful while clamped; compare full content height to visible box.
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
    // Re-measure when the text or expansion state changes.
  }, [text, expanded]);

  if (!text) {
    return <p className={className}>—</p>;
  }

  return (
    <div>
      <p
        ref={ref}
        className={`${className} ${expanded ? "" : CLAMP_CLASS[lines]}`}
      >
        {text}
      </p>
      {(isOverflowing || expanded) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}
