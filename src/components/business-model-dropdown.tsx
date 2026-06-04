"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Shuffle } from "lucide-react";
import { BUSINESS_MODELS } from "@/lib/business-models";
import { BusinessModelIcon } from "@/components/business-model-icon";

interface BusinessModelDropdownProps {
  selected: string;
  onChange: (value: string) => void;
}

export function BusinessModelDropdown({
  selected,
  onChange,
}: BusinessModelDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedModel = BUSINESS_MODELS.find((m) => m.value === selected);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white hover:border-slate-600 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedModel ? (
            <>
              <BusinessModelIcon
                model={selectedModel.value}
                className="size-4 shrink-0"
              />
              <span className="truncate">{selectedModel.label}</span>
            </>
          ) : (
            <>
              <Shuffle className="size-4 text-amber-400 shrink-0" />
              <span>Cualquiera</span>
            </>
          )}
        </div>
        <ChevronDown
          className={`size-4 text-slate-500 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-full min-w-[320px] rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1.5 max-h-[360px] overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
              !selected
                ? "bg-amber-500/10 text-amber-400"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Shuffle className="size-4 shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-medium">Cualquiera</span>
              <p className="text-xs text-slate-500 mt-0.5">
                La IA elegirá el modelo más adecuado según las tendencias
              </p>
            </div>
          </button>
          <div className="my-1 border-t border-slate-800" />
          {BUSINESS_MODELS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                onChange(m.value);
                setOpen(false);
              }}
              className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                selected === m.value
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <BusinessModelIcon
                model={m.value}
                className="size-4 shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <span className="text-sm font-medium">{m.label}</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {m.description}
                </p>
                <p className="text-xs text-slate-600 mt-0.5 italic">
                  Ej: {m.example}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
