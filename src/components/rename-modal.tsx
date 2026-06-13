"use client";

import { useState, useCallback, useEffect } from "react";
import { Check, Pencil } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";

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

  const canSave = !!name.trim() && name.trim() !== currentTitle;

  // ── Render ──

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Editar nombre"
      icon={<Pencil className="size-5 text-primary" />}
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!canSave}
          >
            {!saving && <Check className="size-4" />}
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </>
      }
    >
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
          if (e.key === "Enter" && canSave) handleSave();
        }}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
        placeholder="Nombre de la idea..."
        autoFocus
      />
    </Modal>
  );
}
