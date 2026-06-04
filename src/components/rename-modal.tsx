"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Check, Pencil, Loader2 } from "lucide-react";

// ── Types ──

interface RenameModalProps {
  open: boolean;
  ideaId: string;
  currentTitle: string;
  onClose: () => void;
  onRenamed: () => void;
}

// ── Component ──

export default function RenameModal({
  open,
  ideaId,
  currentTitle,
  onClose,
  onRenamed,
}: RenameModalProps) {
  const [name, setName] = useState(currentTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setName(currentTitle);
      setError("");
    }
  }, [open, currentTitle]);

  // ── Save ──
  async function handleSave() {
    if (!name.trim() || name.trim() === currentTitle) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title: name.trim() }),
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
    if (!saving) {
      setName(currentTitle);
      setError("");
      onClose();
    }
  }, [saving, currentTitle, onClose]);

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
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Pencil className="size-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Editar nombre</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <label className="block text-sm text-slate-400 mb-2">
            Nombre de la idea
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && name.trim() !== currentTitle) {
                handleSave();
              }
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
            placeholder="Nombre de la idea..."
            autoFocus
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || name.trim() === currentTitle}
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
      </div>
    </div>
  );
}
