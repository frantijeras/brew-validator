"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DemoLimitDialog } from "@/components/demo-limit-dialog";

/**
 * RefineIdeaModal — refinado de la idea asistido por IA, ANTES de validar.
 *
 * Flujo en 3 pasos:
 *  1. Formulario: el usuario elige qué campos refinar (checkbox por campo con
 *     vista previa del valor actual) y escribe una instrucción libre. Al pulsar
 *     "Refinar" se lanza POST /api/ideas/[id]/refine → { jobId }. Si el backend
 *     responde 403 (límite de plan) se abre el DemoLimitDialog (type "refine").
 *  2. Procesando: se sondea GET /api/jobs/[jobId] cada ~2s hasta COMPLETED/FAILED.
 *  3. Vista previa: ANTES vs DESPUÉS por campo, cada uno con checkbox (marcado por
 *     defecto) y textarea editable para el valor propuesto. "Aplicar seleccionados"
 *     hace PATCH /api/ideas/[id] con los campos marcados y refresca la página.
 */

/** Campos permitidos para refinar, con su etiqueta en español. */
const REFINABLE_FIELDS = [
  { key: "description", label: "Descripción" },
  { key: "problem", label: "Problema" },
  { key: "valueProposition", label: "Propuesta de valor" },
  { key: "targetUser", label: "Usuario objetivo" },
  { key: "monetization", label: "Monetización" },
] as const;

type FieldKey = (typeof REFINABLE_FIELDS)[number]["key"];

/** Subconjunto de la idea con los campos refinables (valores actuales). */
export type RefinableIdea = Partial<Record<FieldKey, string | null>>;

type Step = "form" | "processing" | "preview";

interface RefineIdeaModalProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  /** Valores actuales de los campos refinables (para ANTES y placeholders). */
  idea: RefinableIdea;
  /** Refresca los datos del padre tras aplicar los cambios. */
  onApplied?: () => void;
}

const POLL_INTERVAL_MS = 2000;

export function RefineIdeaModal({
  open,
  onClose,
  ideaId,
  idea,
  onApplied,
}: RefineIdeaModalProps) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");

  // Paso 1 — formulario
  const [selected, setSelected] = useState<Record<FieldKey, boolean>>(
    () => emptySelection()
  );
  const [instruction, setInstruction] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimit, setShowLimit] = useState(false);

  // Paso 2 — procesando
  const jobIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Paso 3 — vista previa
  const [proposed, setProposed] = useState<Partial<Record<FieldKey, string>>>({});
  const [accepted, setAccepted] = useState<Record<FieldKey, boolean>>(
    () => emptySelection()
  );
  const [applying, setApplying] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Reinicia todo el estado al cerrar (para que reabrir empiece limpio).
  const resetAll = useCallback(() => {
    stopPolling();
    jobIdRef.current = null;
    setStep("form");
    setSelected(emptySelection());
    setInstruction("");
    setSubmitting(false);
    setError(null);
    setShowLimit(false);
    setProposed({});
    setAccepted(emptySelection());
    setApplying(false);
  }, [stopPolling]);

  useEffect(() => {
    if (!open) resetAll();
  }, [open, resetAll]);

  // Limpieza del intervalo al desmontar.
  useEffect(() => stopPolling, [stopPolling]);

  function handleClose() {
    resetAll();
    onClose();
  }

  const selectedKeys = REFINABLE_FIELDS.filter((f) => selected[f.key]).map(
    (f) => f.key
  );
  const canSubmit = selectedKeys.length > 0 && instruction.trim().length > 0;

  /* ── Paso 1 → lanzar refinado ── */
  async function handleRefine() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          fields: selectedKeys,
          instruction: instruction.trim(),
        }),
      });
      if (res.status === 403) {
        setShowLimit(true);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo iniciar el refinado");
      }
      const data = await res.json();
      if (!data?.jobId) throw new Error("Respuesta inesperada del servidor");
      jobIdRef.current = data.jobId;
      setStep("processing");
      startPolling(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al refinar");
      setSubmitting(false);
    }
  }

  /* ── Paso 2 → sondeo del job ── */
  function startPolling(jobId: string) {
    stopPolling();
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) return; // reintenta en el siguiente tick
        const job = await res.json();
        if (job.status === "COMPLETED") {
          stopPolling();
          handleCompleted(job.output);
        } else if (job.status === "FAILED") {
          stopPolling();
          setError(job.error || "El refinado ha fallado. Inténtalo de nuevo.");
          setStep("form");
          setSubmitting(false);
        }
      } catch {
        // Error transitorio de red: reintenta en el siguiente tick.
      }
    };
    // Primer tick inmediato + intervalo.
    void tick();
    pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
  }

  /* ── Paso 2 → preparar vista previa ── */
  function handleCompleted(output: unknown) {
    const parsed = parseOutput(output);
    const next: Partial<Record<FieldKey, string>> = {};
    const nextAccepted = emptySelection();
    for (const f of REFINABLE_FIELDS) {
      const value = parsed[f.key];
      if (typeof value === "string" && value.trim().length > 0) {
        next[f.key] = value;
        nextAccepted[f.key] = true; // marcado por defecto
      }
    }
    if (Object.keys(next).length === 0) {
      setError("La IA no devolvió cambios. Inténtalo con otra instrucción.");
      setStep("form");
      setSubmitting(false);
      return;
    }
    setProposed(next);
    setAccepted(nextAccepted);
    setStep("preview");
  }

  /* ── Paso 3 → aplicar cambios ── */
  async function handleApply() {
    const toApply: Record<string, string> = {};
    for (const f of REFINABLE_FIELDS) {
      if (accepted[f.key] && proposed[f.key] !== undefined) {
        toApply[f.key] = (proposed[f.key] ?? "").trim();
      }
    }
    if (Object.keys(toApply).length === 0) {
      setError("Selecciona al menos un campo para aplicar.");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(toApply),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudieron aplicar los cambios");
      }
      onApplied?.();
      handleClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aplicar");
      setApplying(false);
    }
  }

  const proposedKeys = REFINABLE_FIELDS.filter(
    (f) => proposed[f.key] !== undefined
  );
  const acceptedCount = proposedKeys.filter((f) => accepted[f.key]).length;

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Refinar idea con IA"
        icon={<Sparkles className="size-4 text-amber-400" />}
        size={step === "preview" ? "xl" : "lg"}
        tall
        hideClose={step === "processing"}
        footer={renderFooter()}
      >
        {step === "form" && renderForm()}
        {step === "processing" && renderProcessing()}
        {step === "preview" && renderPreview()}
      </Modal>

      <DemoLimitDialog
        open={showLimit}
        onClose={() => setShowLimit(false)}
        type="refine"
      />
    </>
  );

  /* ── Render: footer por paso ── */
  function renderFooter() {
    if (step === "form") {
      return (
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={submitting}
            disabled={!canSubmit}
            onClick={handleRefine}
          >
            <Sparkles className="size-4" />
            Refinar
          </Button>
        </>
      );
    }
    if (step === "preview") {
      return (
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Descartar
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={applying}
            disabled={acceptedCount === 0}
            onClick={handleApply}
          >
            Aplicar seleccionados ({acceptedCount})
          </Button>
        </>
      );
    }
    return null; // procesando: sin footer
  }

  /* ── Render: paso 1 (formulario) ── */
  function renderForm() {
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-400">
          Elige qué campos quieres mejorar y describe cómo. La IA propondrá una
          versión refinada que podrás revisar antes de aplicar.
        </p>

        <div>
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

        <div>
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
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  /* ── Render: paso 2 (procesando) ── */
  function renderProcessing() {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <Sparkles className="size-8 animate-pulse text-amber-400" />
        <div>
          <p className="text-sm font-medium text-white">Refinando tu idea…</p>
          <p className="mt-1 text-sm text-slate-500">
            La IA está trabajando en los campos seleccionados. Esto puede tardar
            unos segundos.
          </p>
        </div>
      </div>
    );
  }

  /* ── Render: paso 3 (vista previa) ── */
  function renderPreview() {
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-400">
          Revisa los cambios propuestos. Marca los que quieras aplicar; puedes
          editar el texto propuesto antes de guardarlo.
        </p>

        <div className="space-y-4">
          {proposedKeys.map((f) => {
            const before = (idea[f.key] ?? "").toString().trim();
            return (
              <div
                key={f.key}
                className="rounded-lg border border-slate-800 bg-slate-900 p-4"
              >
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={accepted[f.key]}
                    onChange={(e) =>
                      setAccepted((prev) => ({
                        ...prev,
                        [f.key]: e.target.checked,
                      }))
                    }
                    className="size-4 shrink-0 accent-amber-500"
                  />
                  <span className="text-sm font-semibold text-white">
                    {f.label}
                  </span>
                </label>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {/* ANTES */}
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                      Antes
                    </p>
                    <div className="min-h-[5rem] whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
                      {before || "—"}
                    </div>
                  </div>
                  {/* DESPUÉS */}
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-emerald-400">
                      <ArrowRight className="size-3" />
                      Después
                    </p>
                    <textarea
                      value={proposed[f.key] ?? ""}
                      onChange={(e) =>
                        setProposed((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                      disabled={!accepted[f.key]}
                      rows={4}
                      className="min-h-[5rem] w-full resize-y rounded-lg border border-emerald-500/30 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
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
function parseOutput(output: unknown): Partial<Record<FieldKey, string>> {
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
