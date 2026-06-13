"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";

/**
 * DeleteConfirmModal — patrón ÚNICO de confirmación destructiva crítica
 * (confirmación por tipeo del nombre). Antes estaba duplicado en
 * `project-header-menu` y `project-row`. Para destructivos menores usa
 * `ConfirmModal` (variant="danger").
 */
export function DeleteConfirmModal({
  open,
  title = "Borrar",
  itemName,
  description,
  confirmLabel = "Borrar",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  /** Nombre que el usuario debe teclear para confirmar. */
  itemName: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  /** Acción destructiva. Debe lanzar (throw) en caso de error para mostrarlo. */
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset al abrir.
  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const match = value.trim() === itemName;

  async function handleConfirm() {
    if (!match || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al borrar");
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onCancel();
      }}
      title={title}
      icon={<AlertTriangle className="size-4 text-danger" />}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={!match}
            loading={busy}
          >
            {!busy && <Trash2 className="size-4" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {description && (
          <div className="text-sm text-slate-300 leading-relaxed">{description}</div>
        )}
        <p className="text-sm text-slate-400">
          Escribe <strong className="text-red-400">{itemName}</strong> para confirmar:
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && match) handleConfirm();
          }}
          placeholder={itemName}
          autoFocus
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        {error && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="size-3" />
            {error}
          </span>
        )}
      </div>
    </Modal>
  );
}
