"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Filter, Shuffle } from "lucide-react";
import { BUSINESS_MODELS } from "@/lib/business-models";
import { BusinessModelIcon } from "@/components/business-model-icon";

interface ModelFilterDropdownProps {
  activeModel: string;
  activeTab: "all" | "archived";
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

  const activeModelData = activeModel
    ? BUSINESS_MODELS.find((m) => m.value === activeModel)
    : null;

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
        {activeModelData ? (
          <>
            <BusinessModelIcon model={activeModelData.value} className="size-3.5" />
            <span>{activeModelData.label}</span>
          </>
        ) : (
          <span>Todos los modelos</span>
        )}
        <ChevronDown className={`size-3.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-72 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1.5 max-h-[420px] overflow-y-auto">
          <button
            onClick={() => selectModel("")}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
              !activeModel
                ? "bg-amber-500/10 text-amber-400"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Shuffle className="size-4" />
            <span>Todos los modelos</span>
          </button>
          <div className="my-1 border-t border-slate-800" />
          {BUSINESS_MODELS.map((m) => (
            <button
              key={m.value}
              onClick={() => selectModel(m.value)}
              className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                activeModel === m.value
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <BusinessModelIcon model={m.value} className="size-4 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-sm font-medium">{m.label}</span>
                <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                <p className="text-xs text-slate-600 mt-0.5 italic">Ej: {m.example}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
