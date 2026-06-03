"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Check, Pencil, Sparkles, Loader2, Globe } from "lucide-react";

// ── Types ──

interface RenameSuggestion {
  name: string;
  available: boolean;
  reason: string;
}

interface RenameModalProps {
  open: boolean;
  ideaId: string;
  currentTitle: string;
  onClose: () => void;
  onRenamed: () => void;
}

type TabId = "write" | "ai";

// ── Component ──

export default function RenameModal({
  open,
  ideaId,
  currentTitle,
  onClose,
  onRenamed,
}: RenameModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("write");
  const [manualName, setManualName] = useState(currentTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // AI suggestion state
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<RenameSuggestion[]>([]);
  const [checkingDomain, setCheckingDomain] = useState<Record<string, boolean>>({});

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setManualName(currentTitle);
      setSuggestions([]);
      setError("");
      setActiveTab("write");
      setLoadingSuggestions(false);
    }
  }, [open, currentTitle]);

  // ── Manual rename ──
  async function handleManualSave() {
    if (!manualName.trim() || manualName.trim() === currentTitle) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title: manualName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al renombrar");
      }
      onRenamed();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al renombrar");
    } finally {
      setSaving(false);
    }
  }

  // ── AI suggestions ──
  async function handleGenerateSuggestions() {
    setLoadingSuggestions(true);
    setError("");
    setSuggestions([]);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/rename-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al generar sugerencias");
      }
      const data = await res.json();
      if (data.suggestions?.length) {
        setSuggestions(data.suggestions);
      } else {
        // Poll for completion
        if (data.jobId) {
          pollSuggestions(data.jobId);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar sugerencias");
      setLoadingSuggestions(false);
    }
  }

  async function pollSuggestions(jobId: string) {
    const maxPolls = 30;
    let polls = 0;
    const interval = setInterval(async () => {
      polls++;
      try {
        const res = await fetch(
          `/api/ideas/${ideaId}/rename-suggestions?jobId=${jobId}`,
          { credentials: "same-origin" }
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "COMPLETED" && data.suggestions?.length) {
          clearInterval(interval);
          setSuggestions(data.suggestions);
          setLoadingSuggestions(false);
        } else if (data.status === "FAILED") {
          clearInterval(interval);
          setError(data.error || "Error al generar sugerencias");
          setLoadingSuggestions(false);
        } else if (polls >= maxPolls) {
          clearInterval(interval);
          setError("Timeout esperando sugerencias");
          setLoadingSuggestions(false);
        }
      } catch {
        if (polls >= maxPolls) {
          clearInterval(interval);
          setError("Timeout esperando sugerencias");
          setLoadingSuggestions(false);
        }
      }
    }, 3000);
  }

  async function handleSelectSuggestion(name: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title: name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al renombrar");
      }
      onRenamed();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al renombrar");
    } finally {
      setSaving(false);
    }
  }

  const handleClose = useCallback(() => {
    if (!saving && !loadingSuggestions) {
      setManualName(currentTitle);
      setSuggestions([]);
      setError("");
      setActiveTab("write");
      onClose();
    }
  }, [saving, loadingSuggestions, currentTitle, onClose]);

  if (!open) return null;

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Pencil className="size-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Renombrar idea</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => { setActiveTab("write"); setError(""); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "write"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Pencil className="size-3.5" />
              Escribir nombre
            </span>
          </button>
          <button
            onClick={() => { setActiveTab("ai"); setError(""); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "ai"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Sugerir con IA
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* ── Tab: Escribir nombre ── */}
          {activeTab === "write" && (
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Nombre actual
              </label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
                placeholder="Nombre de la idea..."
              />
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleManualSave}
                  disabled={saving || !manualName.trim() || manualName.trim() === currentTitle}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Guardar
                    </>
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Sugerir con IA ── */}
          {activeTab === "ai" && (
            <div>
              <p className="text-sm text-slate-400 mb-4">
                La IA analizará tu idea y sugerirá nombres originales con verificación de dominio.
              </p>

              {!loadingSuggestions && suggestions.length === 0 && (
                <button
                  onClick={handleGenerateSuggestions}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow transition-all hover:bg-amber-400 active:bg-amber-600"
                >
                  <Sparkles className="size-4" />
                  Generar sugerencias
                </button>
              )}

              {loadingSuggestions && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <Loader2 className="size-8 animate-spin text-amber-400" />
                  <p className="text-sm text-slate-400">
                    La IA está analizando tu idea...
                  </p>
                  <p className="text-xs text-slate-500">
                    Buscando nombres originales, verificando dominios y marcas registradas
                  </p>
                </div>
              )}

              {suggestions.length > 0 && (
                <div>
                  <p className="text-sm text-slate-400 mb-3">
                    {suggestions.length} sugerencias generadas:
                  </p>
                  <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
                    {suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-700 bg-slate-800/50 p-3.5 transition-all hover:border-slate-600"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-white truncate">
                                {s.name}
                              </h4>
                              <DomainBadge available={s.available} checking={checkingDomain[s.name]} />
                            </div>
                            {s.reason && (
                              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                                {s.reason}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleSelectSuggestion(s.name)}
                            disabled={saving}
                            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                          >
                            {saving ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                            Seleccionar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleGenerateSuggestions}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition-all hover:border-slate-600"
                  >
                    <Sparkles className="size-4" />
                    Generar más sugerencias
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Domain badge ── */

function DomainBadge({
  available,
  checking,
}: {
  available: boolean;
  checking?: boolean;
}) {
  if (checking) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-400">
        <Globe className="size-2.5" />
        Verificando
      </span>
    );
  }

  return available ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
      <Globe className="size-2.5" />
      Dominio libre
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
      <Globe className="size-2.5" />
      Ocupado
    </span>
  );
}
