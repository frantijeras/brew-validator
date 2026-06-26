"use client";

import { useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * RefineIdeaPanel — panel INLINE para refinar la idea asistido por IA, ANTES de
 * validar. Sustituye al antiguo modal de 3 pasos. Aquí vive SOLO el paso de
 * formulario (elegir campos + instrucción). El sondeo del job, la aplicación de
 * los cambios y el estado de "refinando" los gestiona la página padre, que
 * oculta la tarjeta de contenido y muestra un spinner en su lugar.
 */

/** Campos permitidos para refinar, con su etiqueta en español. */
export const REFINABLE_FIELDS = [
  { key: "description", label: "Descripción" },
  { key: "problem", label: "Problema" },
  { key: "valueProposition", label: "Propuesta de valor" },
  { key: "targetUser", label: "Usuario objetivo" },
  { key: "monetization", label: "Monetización" },
] as const;

export type FieldKey = (typeof REFINABLE_FIELDS)[number]["key"];

/** Subconjunto de la idea con los campos refinables (valores actuales). */
export type RefinableIdea = Partial<Record<FieldKey, string | null>>;

interface RefineIdeaPanelProps {
  /** Valores actuales de los campos refinables (para la vista previa muda). */
  idea: RefinableIdea;
  /** Lanza el refinado con los campos elegidos y la instrucción. */
  onSubmit: (fields: FieldKey[], instruction: string) => void;
  onCancel: () => void;
  /** Error a mostrar dentro del panel (p. ej. fallo al iniciar el refinado). */
  error?: string | null;
}

export function RefineIdeaPanel({
  idea,
  onSubmit,
  onCancel,
  error,
}: RefineIdeaPanelProps) {
  const [selected, setSelected] = useState<Record<FieldKey, boolean>>(
    () => emptySelection()
  );
  const [instruction, setInstruction] = useState("");

  const selectedKeys = REFINABLE_FIELDS.filter((f) => selected[f.key]).map(
    (f) => f.key
  );
  const canSubmit = selectedKeys.length > 0 && instruction.trim().length > 0;

  return (
    <div className="mb-8 rounded-xl border border-amber-500/30 bg-slate-900/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-4 text-amber-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Refinar idea con IA
        </h2>
      </div>

      <p className="mb-4 text-sm text-slate-400">
        Elige qué campos quieres mejorar y describe cómo. La IA aplicará una
        versión refinada directamente sobre la idea (podrás deshacerlo).
      </p>

      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Campos a refinar
        </p>
        <div className="space-y-2">
          {REFINABLE_FIELDS.map((f) => {
            const current = (idea[f.key] ?? "").toString().trim();
            return (
              <label
                key={f.key}
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 hover:border-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selected[f.key]}
                  onChange={(e) =>
                    setSelected((prev) => ({
                      ...prev,
                      [f.key]: e.target.checked,
                    }))
                  }
                  className="mt-0.5 size-4 shrink-0 accent-amber-500"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{f.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                    {current || "Sin contenido"}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <label
          htmlFor="refine-instruction"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Instrucción
        </label>
        <textarea
          id="refine-instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          placeholder="Ej: el target son pymes de 10-50 empleados; monetización por suscripción mensual"
          className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canSubmit}
          onClick={() => onSubmit(selectedKeys, instruction.trim())}
        >
          <Sparkles className="size-4" />
          Refinar
        </Button>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function emptySelection(): Record<FieldKey, boolean> {
  return {
    description: false,
    problem: false,
    valueProposition: false,
    targetUser: false,
    monetization: false,
  };
}

/**
 * El output del job puede llegar como objeto o como string JSON. Devuelve un
 * dict plano de campos refinables → string.
 */
export function parseRefineOutput(
  output: unknown
): Partial<Record<FieldKey, string>> {
  let obj: unknown = output;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== "object") return {};
  const record = obj as Record<string, unknown>;
  const result: Partial<Record<FieldKey, string>> = {};
  for (const f of REFINABLE_FIELDS) {
    const v = record[f.key];
    if (typeof v === "string") result[f.key] = v;
    else if (v != null && typeof v !== "object") result[f.key] = String(v);
  }
  return result;
}
