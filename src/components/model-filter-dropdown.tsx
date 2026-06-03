"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Filter } from "lucide-react";
import { BUSINESS_MODELS } from "@/lib/business-models";

interface ModelFilterDropdownProps {
  activeModel: string;
  activeTab: "all" | "favorites" | "archived";
}

export function ModelFilterDropdown({ activeModel, activeTab }: ModelFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const selectedLabel = activeModel
    ? BUSINESS_MODELS.find((m) => m.value === activeModel)?.icon + " " + BUSINESS_MODELS.find((m) => m.value === activeModel)?.label
    : "Todos los modelos";

  function selectModel(model: string) {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (activeTab !== "all") params.set("tab", activeTab);
    if (model) {
      params.set("model", model);
    } else {
      params.delete("model");
    }
    const qs = params.toString();
    router.push(qs ? `/ideas?${qs}` : "/ideas");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-slate-200 transition-colors"
      >
        <Filter className="size-3.5 text-slate-500" />
        <span className="text-slate-400">Tipo:</span>
        <span>{selectedLabel}</span>
        <ChevronDown className={`size-3.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-lg border border-slate-700 bg-slate-850 bg-slate-900 shadow-xl py-1.5 max-h-[320px] overflow-y-auto">
          <button
            onClick={() => selectModel("")}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
              !activeModel
                ? "bg-amber-500/10 text-amber-400"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Todos los modelos
          </button>
          <div className="my-1 border-t border-slate-800" />
          {BUSINESS_MODELS.map((m) => (
            <button
              key={m.value}
              onClick={() => selectModel(m.value)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                activeModel === m.value
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="text-base">{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
