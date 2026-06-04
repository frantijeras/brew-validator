"use client";

import { useState } from "react";

interface TextExpanderProps {
  text: string;
  maxLength?: number;
  className?: string;
}

export function TextExpander({
  text,
  maxLength = 150,
  className = "text-sm text-slate-300 leading-relaxed",
}: TextExpanderProps) {
  const [expanded, setExpanded] = useState(false);

  if (!text || text.length <= maxLength) {
    return <p className={className}>{text || "—"}</p>;
  }

  const displayText = expanded ? text : text.slice(0, maxLength) + "…";

  return (
    <div>
      <p className={className}>{displayText}</p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
      >
        {expanded ? "Ver menos" : "Ver más"}
      </button>
    </div>
  );
}
